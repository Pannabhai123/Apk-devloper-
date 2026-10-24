"""Audio: voiceover integration, music beds, ducking, normalisation, SFX.

Everything here is FFmpeg filter-graph based (no external audio server needed),
plus a small NumPy synthesiser so the system always has a *copyright-clean*
music bed and SFX available even with no internet and no sample packs.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np

from .tools import ffmpeg, has_filter, run

SR = 48000


# --------------------------------------------------------------------------- #
#  basic I/O helpers
# --------------------------------------------------------------------------- #
def write_wav(path: str | Path, samples: np.ndarray, sr: int = SR) -> Path:
    """samples: float32/float64 array shaped (n,) or (n, channels), range -1..1."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    import soundfile as sf

    data = np.asarray(samples, dtype=np.float32)
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    data = np.clip(data, -1.0, 1.0)
    sf.write(str(path), data, sr, subtype="PCM_16")
    return path


def read_wav(path: str | Path) -> tuple[np.ndarray, int]:
    import soundfile as sf

    data, sr = sf.read(str(path), always_2d=False)
    return np.asarray(data, dtype=np.float32), sr


def silence(duration: float, path: str | Path, sr: int = SR) -> Path:
    return write_wav(path, np.zeros((int(duration * sr), 2), dtype=np.float32), sr)


def duration_of(path: str | Path) -> float:
    from .probe import probe

    return probe(path).duration


# --------------------------------------------------------------------------- #
#  loudness
# --------------------------------------------------------------------------- #
_LOUD_RE = re.compile(r"\{[^{}]*\"input_i\"[^{}]*\}", re.S)


def measure_loudness(path: str | Path) -> dict:
    """EBU R128 analysis pass. Returns the loudnorm JSON block."""
    exe = ffmpeg()
    res = run([exe, "-hide_banner", "-nostats", "-i", str(path),
               "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
               "-f", "null", "-"], timeout=900)
    m = _LOUD_RE.search((res.stderr or "").replace("\n", " "))
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return {}


def normalize_audio(src: str | Path, dst: str | Path, *, target_i: float = -14.0,
                    true_peak: float = -1.5, lra: float = 11.0,
                    two_pass: bool = True) -> Path:
    """Loudness-normalise to YouTube's -14 LUFS target (two-pass when possible)."""
    exe = ffmpeg()
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    measured = measure_loudness(src) if two_pass else {}
    if measured and measured.get("input_i") not in (None, "-inf"):
        af = (f"loudnorm=I={target_i}:TP={true_peak}:LRA={lra}"
              f":measured_I={measured['input_i']}:measured_TP={measured['input_tp']}"
              f":measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}"
              f":linear=true:print_format=summary")
    else:
        af = f"loudnorm=I={target_i}:TP={true_peak}:LRA={lra}:print_format=summary"
    run([exe, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", af, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(dst)],
        timeout=1800, check=True)
    return dst


# --------------------------------------------------------------------------- #
#  mixing voice + music with side-chain ducking
# --------------------------------------------------------------------------- #
def mix_voice_music(voice: str | Path | None, music: str | Path | None,
                    out: str | Path, *, duration: float | None = None,
                    voice_gain_db: float = 0.0, music_gain_db: float = -18.0,
                    duck: bool = True, duck_ratio: float = 8.0,
                    duck_threshold: float = 0.03,
                    fade_in: float = 1.5, fade_out: float = 2.5,
                    sample_rate: int = SR) -> Path:
    """Mix a voiceover stem with a looping music bed.

    - music is looped to cover the full duration (``-stream_loop -1``)
    - music level is user-controlled in dB, then ducked by the voice via
      ``sidechaincompress`` so narration always sits on top
    - short fades prevent clicks at the head/tail
    """
    exe = ffmpeg()
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)

    has_voice = voice and Path(voice).exists()
    has_music = music and Path(music).exists()
    if not has_voice and not has_music:
        if duration is None:
            raise ValueError("need a duration to generate silence")
        return silence(duration, out)
    if has_voice and not duration:
        duration = duration_of(voice)
    if duration is None:
        duration = duration_of(music if has_voice is False else voice)

    if has_voice and has_music:
        can_duck = duck and has_filter("sidechaincompress")
        parts = [
            f"[0:a]aformat=sample_fmts=fltp:sample_rates={sample_rate}:channel_layouts=stereo,"
            f"volume={voice_gain_db}dB,apad=whole_dur={duration:.3f},atrim=0:{duration:.3f}[voice]",
            f"[1:a]aformat=sample_fmts=fltp:sample_rates={sample_rate}:channel_layouts=stereo,"
            f"volume={music_gain_db}dB,atrim=0:{duration:.3f},"
            f"afade=t=in:st=0:d={fade_in},"
            f"afade=t=out:st={max(0.0, duration - fade_out):.3f}:d={fade_out}[music]",
        ]
        if can_duck:
            # the voice is needed twice (as the bed's side-chain key and as a
            # direct mix input), and an FFmpeg label may only be consumed once
            parts.append("[voice]asplit=2[voice_main][voice_key]")
            parts.append(
                f"[music][voice_key]sidechaincompress=threshold={duck_threshold}:"
                f"ratio={duck_ratio}:attack=20:release=450:makeup=1[ducked]"
            )
            parts.append(
                "[voice_main][ducked]amix=inputs=2:duration=first:"
                "dropout_transition=0:normalize=0,alimiter=limit=0.97[aout]"
            )
        else:
            parts.append(
                "[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,"
                "alimiter=limit=0.97[aout]"
            )
        filter_complex = ";".join(parts)
        run([exe, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(voice), "-stream_loop", "-1", "-i", str(music),
             "-filter_complex", filter_complex, "-map", "[aout]",
             "-t", f"{duration:.3f}", "-c:a", "pcm_s16le", "-ar", str(sample_rate),
             "-ac", "2", str(out)], timeout=1800, check=True)
        return out

    # single source
    src = voice if has_voice else music
    gain = voice_gain_db if has_voice else music_gain_db
    af = (f"aformat=sample_fmts=fltp:sample_rates={sample_rate}:channel_layouts=stereo,"
          f"volume={gain}dB,apad=whole_dur={duration:.3f},atrim=0:{duration:.3f},"
          f"afade=t=in:st=0:d={fade_in},"
          f"afade=t=out:st={max(0.0, duration - fade_out):.3f}:d={fade_out}")
    run([exe, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", af, "-c:a", "pcm_s16le", "-ar", str(sample_rate), "-ac", "2", str(out)],
        timeout=1800, check=True)
    return out


def concat_audio(files: list[str | Path], out: str | Path, *, gaps: list[float] | None = None,
                 sample_rate: int = SR) -> Path:
    """Concatenate narration chunks with optional silence gaps between them."""
    exe = ffmpeg()
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmpdir = out.parent / "_concat_tmp"
    tmpdir.mkdir(exist_ok=True)
    seq: list[Path] = []
    gaps = gaps or [0.0] * (len(files) + 1)
    for i, f in enumerate(files):
        gap = gaps[i] if i < len(gaps) else 0.0
        if gap > 0.01:
            g = tmpdir / f"gap_{i:04d}.wav"
            silence(gap, g, sample_rate)
            seq.append(g)
        seq.append(Path(f))
    if len(gaps) > len(files) and gaps[len(files)] > 0.01:
        g = tmpdir / "gap_tail.wav"
        silence(gaps[len(files)], g, sample_rate)
        seq.append(g)

    lst = tmpdir / "list.txt"
    lst.write_text("".join(f"file '{Path(p).resolve()}'\n" for p in seq))
    run([exe, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", str(lst), "-c:a", "pcm_s16le", "-ar", str(sample_rate), "-ac", "2", str(out)],
        timeout=1800, check=True)
    return out


# --------------------------------------------------------------------------- #
#  procedural, royalty-free music beds & SFX
# --------------------------------------------------------------------------- #
_NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
         "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}

# Am - F - C - G  (i - VI - III - VII): neutral, documentary-friendly
PROGRESSIONS = {
    "calm": [("A", [0, 3, 7]), ("F", [0, 4, 7]), ("C", [0, 4, 7]), ("G", [0, 4, 7])],
    "uplifting": [("C", [0, 4, 7]), ("G", [0, 4, 7]), ("A", [0, 3, 7]), ("F", [0, 4, 7])],
    "cinematic": [("D", [0, 3, 7]), ("Bb", [0, 4, 7]), ("F", [0, 4, 7]), ("C", [0, 4, 7])],
    "focus": [("A", [0, 3, 7]), ("A", [0, 3, 7]), ("F", [0, 4, 7]), ("G", [0, 4, 7])],
}


def _midi_hz(semitones_from_c4: int) -> float:
    return 261.625565 * (2 ** (semitones_from_c4 / 12))


def _lowpass(x: np.ndarray, cutoff: float, sr: int) -> np.ndarray:
    from scipy.signal import butter, lfilter

    b, a = butter(2, min(0.99, cutoff / (sr / 2)), btype="low")
    return lfilter(b, a, x, axis=0)


def _reverb(x: np.ndarray, sr: int, decay=0.35, length=1.2, seed=11) -> np.ndarray:
    """Cheap convolution reverb with an exponentially decaying noise tail."""
    rng = np.random.default_rng(seed)
    n = int(length * sr)
    ir = rng.normal(0, 1, (n, 1)) * np.exp(-np.linspace(0, 6, n)).reshape(-1, 1)
    ir = _lowpass(ir, 4000, sr)
    ir /= np.abs(ir).sum() * 0.08 + 1e-9
    from scipy.signal import fftconvolve

    wet = fftconvolve(x, ir, mode="full", axes=0)[: len(x)]
    return x * (1 - decay) + wet * decay


def synth_music_bed(duration: float, out: str | Path, *, style: str = "calm",
                    bpm: float = 84.0, seed: int = 5, sr: int = SR,
                    target_lufs_hint: float = -22.0) -> Path:
    """Generate a soft, loopable ambient bed (pads + sub + arpeggio + light pulse)."""
    rng = np.random.default_rng(seed)
    n = int(duration * sr)
    t = np.arange(n) / sr
    beat = 60.0 / bpm
    bar = beat * 4
    prog = PROGRESSIONS.get(style, PROGRESSIONS["calm"])

    mix = np.zeros((n, 2), dtype=np.float32)

    def add(sig: np.ndarray, gain: float, pan: float = 0.0):
        left = gain * (1 - max(0.0, pan))
        right = gain * (1 + min(0.0, pan))
        mix[:, 0] += sig[:, 0] if sig.ndim == 2 else sig * left
        mix[:, 1] += sig[:, 1] if sig.ndim == 2 else sig * right

    # --- pads: one chord per bar, slow attack, detuned saw-ish stack -------
    n_bars = int(math.ceil(duration / bar)) + 1
    for b in range(n_bars):
        root, intervals = prog[b % len(prog)]
        base = 48 + _NOTE[root]  # octave 4-ish (C4 = 60 -> here 48 maps low/mid)
        start = int(b * bar * sr)
        end = min(n, int((b + 1) * bar * sr + 0.4 * sr))
        if start >= n:
            break
        seg_t = np.arange(end - start) / sr
        env = np.minimum(1.0, seg_t / 0.9) * np.exp(-np.maximum(0, seg_t - bar * 0.8) * 2.2)
        seg = np.zeros((end - start, 2), dtype=np.float32)
        for semi in intervals:
            for octave, g in ((0, 1.0), (12, 0.45)):
                f = _midi_hz(base + semi + octave - 12)
                for det in (-0.15, 0.0, 0.15):
                    ph = rng.uniform(0, 2 * np.pi)
                    w = np.sin(2 * np.pi * (f + det) * seg_t + ph)
                    w += 0.25 * np.sin(2 * np.pi * 2 * (f + det) * seg_t + ph)
                    seg[:, 0] += (w * g * 0.06).astype(np.float32)
                    seg[:, 1] += (w * g * 0.055).astype(np.float32)
        seg *= env[:, None]
        mix[start:end] += seg

    # --- sub bass: root, one note per bar --------------------------------
    for b in range(n_bars):
        root, _ = prog[b % len(prog)]
        f = _midi_hz(48 + _NOTE[root] - 24)
        start, end = int(b * bar * sr), min(n, int((b + 1) * bar * sr))
        if start >= n:
            break
        st = np.arange(end - start) / sr
        env = np.minimum(1.0, st / 0.25) * np.exp(-st * 0.9)
        w = np.sin(2 * np.pi * f * st) * env * 0.12
        mix[start:end, 0] += w.astype(np.float32)
        mix[start:end, 1] += w.astype(np.float32)

    # --- arpeggio / shimmer on the off-beats -----------------------------
    if style != "focus":
        step_beats = 1.0
        n_steps = int(duration / (beat * step_beats)) + 1
        for i in range(n_steps):
            root, intervals = prog[(i // 4) % len(prog)]
            note = intervals[i % len(intervals)] + 12 + rng.choice([0, 12])
            f = _midi_hz(48 + _NOTE[root] + note)
            start = int(i * beat * step_beats * sr)
            ln = int(0.9 * sr)
            end = min(n, start + ln)
            if start >= n:
                break
            st = np.arange(end - start) / sr
            env = np.exp(-st * 3.2) * np.minimum(1.0, st / 0.01)
            w = (np.sin(2 * np.pi * f * st) * 0.05 * env).astype(np.float32)
            pan = 0.35 if i % 2 == 0 else -0.35
            mix[start:end, 0] += w * (1 - pan) * 0.8
            mix[start:end, 1] += w * (1 + pan) * 0.8

    # --- gentle pulse / heartbeat for energy -----------------------------
    if style in ("uplifting", "cinematic"):
        for i in range(int(duration / bar) + 1):
            start = int(i * bar * sr)
            ln = int(0.28 * sr)
            end = min(n, start + ln)
            if start >= n:
                break
            st = np.arange(end - start) / sr
            env = np.exp(-st * 16)
            f = 55 * np.exp(-st * 8) + 40
            w = (np.sin(2 * np.pi * f * st) * 0.16 * env).astype(np.float32)
            mix[start:end, 0] += w
            mix[start:end, 1] += w

    # --- polish ----------------------------------------------------------
    mix = _lowpass(mix, 9000, sr)
    mix = _reverb(mix, sr, decay=0.45, length=1.8)
    mix = _lowpass(mix, 12000, sr)
    # fade edges
    fl = int(min(duration, 2.0) * 0.5 * sr)
    if fl > 0:
        ramp = np.linspace(0, 1, fl)[:, None]
        mix[:fl] *= ramp
        mix[-fl:] *= ramp[::-1]
    peak = float(np.abs(mix).max()) or 1.0
    mix = mix / peak * 0.5        # ~-6 dBFS peak, we set the real level at mix time
    return write_wav(out, mix, sr)


def synth_sfx(kind: str, out: str | Path, *, sr: int = SR, duration: float | None = None) -> Path:
    """Generate a short transition sound. kinds: whoosh, pop, riser, chime, impact."""
    if kind == "whoosh":
        d = duration or 0.9
        n = int(d * sr)
        t = np.arange(n) / sr
        noise = np.random.default_rng(21).normal(0, 1, n)
        # sweeping band-pass approximated by modulated low-pass on noise
        sweep = np.linspace(2200, 180, n)
        sig = np.zeros(n)
        acc = 0.0
        for i in range(n):
            a = math.exp(-2 * math.pi * sweep[i] / sr)
            acc = a * acc + (1 - a) * noise[i]
            sig[i] = acc
        env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
        sig *= env
    elif kind == "pop":
        d = duration or 0.18
        n = int(d * sr)
        t = np.arange(n) / sr
        sig = np.sin(2 * np.pi * (900 * np.exp(-t * 12) + 200) * t) * np.exp(-t * 26)
    elif kind == "riser":
        d = duration or 2.0
        n = int(d * sr)
        t = np.arange(n) / sr
        f = 180 * (2 ** (t / d * 2.2))
        sig = np.sin(2 * np.pi * np.cumsum(f) / sr) * (t / d) ** 2
        sig += 0.15 * np.random.default_rng(4).normal(0, 1, n) * (t / d) ** 3
    elif kind == "chime":
        d = duration or 1.6
        n = int(d * sr)
        t = np.arange(n) / sr
        sig = (np.sin(2 * np.pi * 880 * t) * np.exp(-t * 3) * 0.6 +
               np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 4) * 0.3 +
               np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 5) * 0.15)
    elif kind == "impact":
        d = duration or 1.2
        n = int(d * sr)
        t = np.arange(n) / sr
        sig = np.sin(2 * np.pi * 60 * np.exp(-t * 3) * t) * np.exp(-t * 4)
        sig += 0.3 * np.random.default_rng(9).normal(0, 1, n) * np.exp(-t * 14)
    else:
        raise ValueError(f"unknown sfx kind {kind!r}")

    sig = sig / (np.abs(sig).max() or 1.0) * 0.55
    # equal-power stereo-ish placement
    stereo = np.stack([sig * 0.95, sig * 0.85], axis=1)
    return write_wav(out, stereo, sr)


def add_sfx_layer(bed: str | Path, out: str | Path, cues: list[tuple[float, str, float]]):
    """Overlay generated SFX onto a bed. cues = [(time_seconds, kind, gain)]"""
    exe = ffmpeg()
    base = read_wav(bed)
    data, sr = base
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    data = data.copy()
    tmp = Path(out).parent / "_sfx"
    tmp.mkdir(parents=True, exist_ok=True)
    for i, (at, kind, gain) in enumerate(cues):
        p = synth_sfx(kind, tmp / f"sfx_{i}_{kind}.wav", sr=sr)
        s, _ = read_wav(p)
        if s.ndim == 1:
            s = np.stack([s, s], axis=1)
        start = int(at * sr)
        end = min(len(data), start + len(s))
        if start >= len(data):
            continue
        data[start:end] += s[: end - start] * gain
    np.clip(data, -1, 1, out=data)
    return write_wav(out, data, sr)


# --------------------------------------------------------------------------- #
#  Text-to-speech back-ends (optional, none required)
# --------------------------------------------------------------------------- #
def tts_available() -> dict:
    import os as _os
    import shutil

    try:
        from . import tts_espeak

        local_lib = tts_espeak.available()
    except Exception:
        local_lib = False
    return {
        "espeak-ng(lib)": local_lib,          # offline, always available here
        "espeak-ng(cli)": bool(shutil.which("espeak-ng") or shutil.which("espeak")),
        "piper": bool(shutil.which("piper")),
        "elevenlabs": bool(_os.environ.get("ELEVENLABS_API_KEY")),
        "openai": bool(_os.environ.get("OPENAI_API_KEY")),
        "azure": bool(_os.environ.get("AZURE_SPEECH_KEY")),
    }


def tts(text: str, out: str | Path, *, engine: str = "auto", voice: str | None = None,
        language: str = "en") -> Path:
    """Synthesise narration. Prefers user-supplied audio; this is only a fallback.

    Engines are tried in order of quality that is actually available locally:
    piper -> espeak-ng -> cloud API (if a key exists) -> clear error.
    """
    import os
    import shutil

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    order = [engine] if engine != "auto" else [
        "piper", "espeak-ng(lib)", "espeak-ng", "elevenlabs", "openai"]

    for eng in order:
        try:
            if eng == "piper":
                exe = shutil.which("piper")
                if not exe:
                    continue
                model = os.environ.get("YTV_PIPER_MODEL")
                if not model or not Path(model).exists():
                    continue
                wav = out.with_suffix(".wav")
                proc = run([exe, "--model", model, "--output_file", str(wav)],
                           capture=False, timeout=1800)
                del proc
                # piper reads text from stdin
                import subprocess

                subprocess.run([exe, "--model", model, "--output_file", str(wav)],
                               input=text.encode(), check=True)
                run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(wav), str(out)], check=True)
                return out
            if eng == "espeak-ng(lib)":
                from . import tts_espeak

                if not tts_espeak.available():
                    continue
                raw = out.with_name(out.stem + "_raw.wav")
                tts_espeak.synthesize(text, raw, voice=voice or "en-us",
                                      rate=int(os.environ.get("YTV_TTS_RATE", 158)))
                run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(raw),
                     "-ar", str(SR), "-ac", "2", "-af", "highpass=f=90,lowpass=f=8000",
                     str(out)], check=True)
                return out
            if eng == "espeak-ng":
                exe = shutil.which("espeak-ng") or shutil.which("espeak")
                if not exe:
                    continue
                wav = out.with_suffix(".wav")
                run([exe, "-v", voice or language, "-s", "150", "-w", str(wav), text],
                    timeout=900, check=True)
                run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(wav), "-ar", str(SR),
                     "-ac", "2", str(out)], check=True)
                return out
            if eng == "elevenlabs":
                key = os.environ.get("ELEVENLABS_API_KEY")
                vid = voice or os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
                if not key:
                    continue
                import urllib.request

                req = urllib.request.Request(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
                    data=json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode(),
                    headers={"xi-api-key": key, "Content-Type": "application/json"},
                )
                out.with_suffix(".mp3").write_bytes(urllib.request.urlopen(req, timeout=180).read())
                run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(out.with_suffix(".mp3")),
                     "-ar", str(SR), "-ac", "2", str(out)], check=True)
                return out
            if eng == "openai":
                key = os.environ.get("OPENAI_API_KEY")
                if not key:
                    continue
                import urllib.request

                boundary = "----ytv" + uuid_hex()
                body = _multipart(boundary, {
                    "model": "gpt-4o-mini-tts",
                    "voice": voice or "alloy",
                    "input": text,
                })
                req = urllib.request.Request(
                    "https://api.openai.com/v1/audio/speech", data=body,
                    headers={"Authorization": f"Bearer {key}",
                             "Content-Type": f"multipart/form-data; boundary={boundary}"})
                out.with_suffix(".mp3").write_bytes(urllib.request.urlopen(req, timeout=180).read())
                run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(out.with_suffix(".mp3")),
                     "-ar", str(SR), "-ac", "2", str(out)], check=True)
                return out
        except Exception as exc:  # keep trying other engines
            import sys

            print(f"[tts] {eng} failed: {exc}", file=sys.stderr)
            continue

    raise RuntimeError(
        "No TTS engine available. Supply a recorded/generated voiceover file instead "
        "(vo.mp3), or install piper/espeak-ng, or set an API key."
    )


def uuid_hex() -> str:
    import uuid

    return uuid.uuid4().hex


def _multipart(boundary: str, fields: dict) -> bytes:
    out = b""
    for k, v in fields.items():
        out += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    out += f"--{boundary}--\r\n".encode()
    return out


# --------------------------------------------------------------------------- #
#  Speech timing estimation (used when no transcription is available)
# --------------------------------------------------------------------------- #
def estimate_speech_seconds(text: str, *, wpm: float = 150.0,
                            pause_per_sentence: float = 0.35) -> float:
    words = max(1, len(re.findall(r"\S+", text)))
    sentences = max(1, len(re.findall(r"[.!?]+", text)))
    return words / wpm * 60.0 + sentences * pause_per_sentence


def split_script(text: str, *, max_chars: int = 90) -> list[str]:
    """Split narration into caption-sized chunks at natural boundaries."""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(s) <= max_chars:
            chunks.append(s)
            continue
        # split long sentences on commas / semicolons, then on words
        parts, cur = [], ""
        for piece in re.split(r"(?<=[,;:])\s+", s):
            if len(cur) + len(piece) + 1 <= max_chars:
                cur = f"{cur} {piece}".strip()
            else:
                if cur:
                    parts.append(cur)
                cur = piece
        if cur:
            parts.append(cur)
        for p in parts:
            if len(p) <= max_chars:
                chunks.append(p)
            else:
                words, cur = p.split(), ""
                for w in words:
                    if len(cur) + len(w) + 1 <= max_chars:
                        cur = f"{cur} {w}".strip()
                    else:
                        chunks.append(cur)
                        cur = w
                if cur:
                    chunks.append(cur)
    return [c for c in chunks if c]
