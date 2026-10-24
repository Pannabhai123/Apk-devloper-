"""FFmpeg building blocks: Ken-Burns stills, clip normalisation, animated
overlays, transitions, audio muxing, encode + verification.

All functions are idempotent and write to explicit paths, which is what makes
segmented / resumable rendering possible.
"""

from __future__ import annotations

import json
import math
import os
import shutil
from pathlib import Path

from .presets import VideoPreset, intermediate_for
from .probe import probe
from .tools import ffmpeg, fontconfig_env, has_filter, run

# --------------------------------------------------------------------------- #
#  small helpers
# --------------------------------------------------------------------------- #
def _ensure_parent(p: Path) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _ff() -> str:
    exe = ffmpeg()
    if not exe:
        raise RuntimeError("FFmpeg not found - run ./bootstrap.sh")
    return str(exe)


def _enc_args(p: VideoPreset, *, crf: int | None = None, preset: str | None = None) -> list[str]:
    p2 = p
    args = [
        "-c:v", p2.codec if p2.codec.startswith("lib") else "libx264",
        "-preset", preset or p2.x264_preset,
        "-crf", str(crf if crf is not None else p2.crf),
        "-pix_fmt", p2.pixel_format,
        "-profile:v", p2.profile,
        "-g", str(int(p2.fps * p2.gop_seconds)),
    ]
    args += p2.extra_args
    return args


def duration(path: str | Path) -> float:
    return probe(path).duration


# --------------------------------------------------------------------------- #
#  stills -> animated clips
# --------------------------------------------------------------------------- #
def kenburns_filter(width: int, height: int, fps: int, dur: float,
                    mode: str = "zoom_in", strength: float = 1.12) -> str:
    """Deterministic Ken-Burns motion for a single still.

    Implemented with ``zoompan`` fed by a 2x upscale (prevents sub-pixel
    jitter that makes text shimmer).
    """
    frames = max(1, int(round(dur * fps)))
    z_end = strength
    up_w, up_h = width * 2, height * 2
    if mode == "none":
        # no motion, but zoompan is still the cleanest way to clone one frame
        # into exactly `frames` output frames (a bare fps filter would not)
        return (
            f"scale={up_w}:{up_h}:flags=lanczos,"
            f"zoompan=z='1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d={frames}:s={width}x{height}:fps={fps},format=yuv420p,setsar=1"
        )
    if mode in ("zoom_in", "in"):
        z = f"min(1+({z_end}-1)*on/{frames},{z_end})"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif mode in ("zoom_out", "out"):
        z = f"max({z_end}-({z_end}-1)*on/{frames},1)"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif mode == "pan_left":
        z = f"{z_end}"
        x, y = f"(iw-iw/zoom)*(1-on/{frames})", "ih/2-(ih/zoom/2)"
    elif mode == "pan_right":
        z = f"{z_end}"
        x, y = f"(iw-iw/zoom)*on/{frames}", "ih/2-(ih/zoom/2)"
    elif mode == "pan_up":
        z = f"{z_end}"
        x, y = "iw/2-(iw/zoom/2)", f"(ih-ih/zoom)*(1-on/{frames})"
    else:
        z, x, y = f"{z_end}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    return (
        f"scale={up_w}:{up_h}:flags=lanczos,"
        f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={width}x{height}:fps={fps},"
        f"format=yuv420p,setsar=1"
    )


def still_to_clip(image: str | Path, out: str | Path, *, dur: float,
                  preset: VideoPreset, motion: str = "zoom_in",
                  strength: float = 1.12, crf: int | None = None,
                  fade_in: float = 0.0, fade_out: float = 0.0) -> Path:
    """Turn one still into a video clip with optional Ken-Burns motion + fades."""
    out = _ensure_parent(Path(out))
    vf = kenburns_filter(preset.width, preset.height, preset.fps, dur, motion, strength)
    if fade_in or fade_out:
        fades = []
        if fade_in:
            fades.append(f"fade=t=in:st=0:d={fade_in}")
        if fade_out:
            fades.append(f"fade=t=out:st={max(0.0, dur - fade_out):.3f}:d={fade_out}")
        vf += "," + ",".join(fades)
    frames = max(1, int(round(dur * preset.fps)))
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y",
           "-i", str(image),
           "-vf", vf, "-frames:v", str(frames), "-r", str(preset.fps),
           *_enc_args(preset, crf=crf),
           "-an", "-movflags", "+faststart", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


def compose_still_clip(image: str | Path, out: str | Path, *, preset: VideoPreset,
                       dur: float, motion: str = "zoom_in", strength: float = 1.12,
                       overlays: list | None = None, crf: int | None = None,
                       fade_in: float = 0.0, fade_out: float = 0.0) -> Path:
    """One-encode scene: Ken-Burns base still + any number of animated overlays.

    ``overlays`` = [(png, start, end, slide, slide_px), ...] where ``slide`` is
    None | 'up' | 'left' | 'right'. Fusing base motion and text animation into a
    single FFmpeg pass roughly halves render time versus a two-pass approach.
    """
    out = _ensure_parent(Path(out))
    w, h, fps = preset.width, preset.height, preset.fps
    frames = max(1, int(round(dur * fps)))
    inputs = ["-i", str(image)]
    chains = [f"[0:v]{kenburns_filter(w, h, fps, dur, motion, strength)}[base]"]
    prev = "base"
    for i, spec in enumerate(overlays or []):
        png, start, end, slide, px = (list(spec) + [None, 60])[:5]
        inputs += ["-loop", "1", "-framerate", str(fps), "-t", f"{dur:.3f}", "-i", str(png)]
        idx = i + 1
        d_in = min(0.45, max(0.1, (end - start) / 3))
        chains.append(
            f"[{idx}:v]format=rgba,fade=t=in:st={start:.3f}:d={d_in:.3f}:alpha=1,"
            f"fade=t=out:st={max(start, end - d_in):.3f}:d={d_in:.3f}:alpha=1[o{i}]"
        )
        x, y = "0", "0"
        if slide == "up":
            y = f"'{px}*(1-min(max((t-{start:.3f})/0.7,0),1))'"
        elif slide == "left":
            x = f"'{-px}*(1-min(max((t-{start:.3f})/0.7,0),1))'"
        elif slide == "right":
            x = f"'{px}*(1-min(max((t-{start:.3f})/0.7,0),1))'"
        chains.append(
            f"[{prev}][o{i}]overlay=x={x}:y={y}:eval=frame:"
            f"enable='between(t,{start:.3f},{end:.3f})'[b{i}]"
        )
        prev = f"b{i}"
    tail = f"[{prev}]"
    if fade_in:
        tail += f"fade=t=in:st=0:d={fade_in},"
    if fade_out:
        tail += f"fade=t=out:st={max(0.0, dur - fade_out):.3f}:d={fade_out},"
    tail += "format=yuv420p[v]"
    chains.append(tail)
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y", *inputs,
           "-filter_complex", ";".join(chains), "-map", "[v]",
           "-frames:v", str(frames), "-r", str(fps), *_enc_args(preset, crf=crf),
           "-an", "-movflags", "+faststart", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


def slideshow(images: list[str | Path], out: str | Path, *, dur_per_image: float,
              preset: VideoPreset, motions: list[str] | None = None) -> Path:
    """A photo-sequence scene (B-roll from stills) with varied motion."""
    out = _ensure_parent(Path(out))
    total = dur_per_image * len(images)
    motions = motions or ["zoom_in", "pan_left", "zoom_out", "pan_right"]
    inputs, chains = [], []
    for i, img in enumerate(images):
        inputs += ["-i", str(img)]
        m = motions[i % len(motions)]
        chains.append(
            f"[{i}:v]{kenburns_filter(preset.width, preset.height, preset.fps, dur_per_image, m)}"
            f"[v{i}]"
        )
    n = len(images)
    if n == 1:
        graph = chains[0]
        map_v = "[v0]"
    else:
        prev = "v0"
        for i in range(1, n):
            lab = f"x{i}"
            chains.append(f"[{prev}][v{i}]xfade=transition=fade:duration=0.5:"
                          f"offset={i * dur_per_image - 0.5:.3f}[{lab}]")
            prev = lab
        graph = ";".join(chains)
        map_v = f"[{prev}]"
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y", *inputs,
           "-filter_complex", graph, "-map", map_v, "-frames:v",
           str(max(1, int(round(total * preset.fps)))), "-t", f"{total:.3f}",
           "-r", str(preset.fps), *_enc_args(preset), "-an",
           "-movflags", "+faststart", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


# --------------------------------------------------------------------------- #
#  clip normalisation
# --------------------------------------------------------------------------- #
def normalize_clip(src: str | Path, out: str | Path, *, preset: VideoPreset,
                   start: float | None = None, dur: float | None = None,
                   mode: str = "cover", motion: str = "none",
                   strength: float = 1.08) -> Path:
    """Conform any input clip to the target resolution/fps/codec.

    mode='cover' crops to fill (no bars); mode='contain' letterboxes with blur
    padding, which looks far better than black bars for mismatched footage.
    """
    out = _ensure_parent(Path(out))
    w, h, fps = preset.width, preset.height, preset.fps
    if mode == "contain":
        vf = (
            f"split=2[bg][fg];"
            f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
            f"boxblur=40:2,eq=brightness=-0.05[bgb];"
            f"[fg]scale={w}:{h}:force_original_aspect_ratio=decrease[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,"
            f"fps={fps},format=yuv420p,setsar=1[v]"
        )
    else:
        vf = (f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,"
              f"crop={w}:{h},fps={fps},format=yuv420p,setsar=1[v]")
    if motion and motion != "none":
        # light motion on static-ish clips: subtle slow zoom
        vf = vf.replace("crop={}:{}".format(w, h), f"crop={w}:{h}", 1)
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y"]
    if start:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += ["-i", str(src)]
    if dur:
        cmd += ["-t", f"{dur:.3f}"]
    cmd += ["-filter_complex", vf, "-map", "[v]", "-r", str(fps), *_enc_args(preset),
            "-an", "-movflags", "+faststart", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


def loop_clip_to_duration(src: str | Path, out: str | Path, *, preset: VideoPreset,
                          dur: float, mode: str = "cover") -> Path:
    """B-roll that is shorter than the scene: stream-loop + trim."""
    out = _ensure_parent(Path(out))
    w, h, fps = preset.width, preset.height, preset.fps
    vf = (f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,"
          f"crop={w}:{h},fps={fps},format=yuv420p,setsar=1")
    run([_ff(), "-hide_banner", "-loglevel", "error", "-y",
         "-stream_loop", "-1", "-i", str(src), "-t", f"{dur:.3f}",
         "-vf", vf, *_enc_args(preset), "-an", "-movflags", "+faststart", str(out)],
        timeout=7200, check=True)
    return out


# --------------------------------------------------------------------------- #
#  animated overlays (titles, lower thirds, bullet builds)
# --------------------------------------------------------------------------- #
def animated_overlay(base: str | Path, overlay_png: str | Path, out: str | Path, *,
                     preset: VideoPreset, dur: float, fade_in: float = 0.45,
                     fade_out: float = 0.45, slide: str | None = None,
                     slide_px: int = 80, delay: float = 0.0) -> Path:
    """Composite a transparent PNG with fade and optional slide-in motion.

    Rendering the text as a still and animating it in FFmpeg is dramatically
    faster than per-frame rasterisation in Python at 1080p.
    """
    out = _ensure_parent(Path(out))
    start = delay
    end = max(start + 0.1, dur - fade_out)
    ov = [f"format=rgba"]
    if fade_in:
        ov.append(f"fade=t=in:st={start:.3f}:d={fade_in}:alpha=1")
    if fade_out:
        ov.append(f"fade=t=out:st={end:.3f}:d={fade_out}:alpha=1")
    if slide == "left":
        x = f"'{slide_px}*(1-min(max((t-{start:.3f})/0.8,0),1))'"
    elif slide == "right":
        x = f"'-{slide_px}*(1-min(max((t-{start:.3f})/0.8,0),1))'"
    else:
        x = "0"
    if slide == "up":
        y = f"'{slide_px}*(1-min(max((t-{start:.3f})/0.8,0),1))'"
    else:
        y = "0"
    graph = (
        f"[0:v][ov]overlay=x={x}:y={y}:eval=frame:format=auto:"
        f"enable='gte(t,{start:.3f})'[v]"
    )
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y",
           "-i", str(base),
           "-loop", "1", "-t", f"{dur:.3f}", "-i", str(overlay_png),
           "-filter_complex",
           f"[1:v]{','.join(ov)}[ov];{graph}",
           "-map", "[v]", "-t", f"{dur:.3f}", "-r", str(preset.fps),
           *_enc_args(preset), "-an", "-movflags", "+faststart", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


def overlay_sequence(base: str | Path, overlays: list[tuple[str | Path, float, float]],
                     out: str | Path, *, preset: VideoPreset, dur: float,
                     slide: str | None = "up") -> Path:
    """Chain several overlay windows: [(png, start, end), ...] in one encode."""
    out = _ensure_parent(Path(out))
    inputs = ["-i", str(base)]
    chains = []
    prev = "0:v"
    for i, (png, start, end) in enumerate(overlays):
        idx = i + 1
        inputs += ["-loop", "1", "-framerate", str(preset.fps), "-t", f"{dur:.3f}",
                   "-i", str(png)]
        fade = 0.35
        chains.append(
            f"[{idx}:v]format=rgba,fade=t=in:st={max(0.0, start):.3f}:d={fade}:alpha=1,"
            f"fade=t=out:st={max(0.0, end - fade):.3f}:d={fade}:alpha=1[o{i}]"
        )
        x = "0"
        if slide in ("left", "right"):
            x = (f"'{60 if slide == 'left' else -60}*(1-min(max((t-{start:.3f})/0.7,0),1))'")
        chains.append(
            f"[{prev}][o{i}]overlay=x={x}:y=0:eval=frame:enable="
            f"'between(t,{start:.3f},{end:.3f})'[b{i}]"
        )
        prev = f"b{i}"
    graph = ";".join(chains) + f";[{prev}]format=yuv420p[v]"
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y", *inputs,
           "-filter_complex", graph, "-map", "[v]", "-t", f"{dur:.3f}",
           "-r", str(preset.fps), *_enc_args(preset), "-an",
           "-movflags", "+faststart", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


# --------------------------------------------------------------------------- #
#  concatenation with transitions
# --------------------------------------------------------------------------- #
def concat_segments(segments: list[str | Path], out: str | Path, *,
                    preset: VideoPreset, transition: str = "fade",
                    transition_duration: float = 0.6,
                    batch_limit: int = 16,
                    post_filters: list[str] | None = None,
                    font_env: dict | None = None) -> Path:
    """Concatenate scene clips, cross-fading picture and sound.

    Uses a single filtergraph when the segment count is small (one re-encode,
    highest quality). For very long videos it renders in batches and joins the
    batches with the concat demuxer.
    """
    out = _ensure_parent(Path(out))
    segments = [Path(s) for s in segments]
    if not segments:
        raise ValueError("no segments to concatenate")
    if len(segments) == 1:
        shutil.copyfile(segments[0], out)
        return out

    if len(segments) > batch_limit:
        batches: list[Path] = []
        tmp = out.parent / "_batches"
        tmp.mkdir(exist_ok=True)
        for i in range(0, len(segments), batch_limit):
            chunk = segments[i:i + batch_limit]
            bp = tmp / f"batch_{i // batch_limit:03d}.mp4"
            concat_segments(chunk, bp, preset=preset, transition=transition,
                            transition_duration=transition_duration, batch_limit=batch_limit,
                            post_filters=post_filters, font_env=font_env)
            batches.append(bp)
        return concat_demuxer(batches, out, preset=preset)

    durs = [duration(s) for s in segments]
    td = min(transition_duration, min(durs) / 2.5)
    has_audio = all(probe(s).has_audio for s in segments)

    inputs = []
    for s in segments:
        inputs += ["-i", str(s)]
    chains, prev_v = [], "0:v"
    offset = 0.0
    for i in range(1, len(segments)):
        offset += durs[i - 1] - td
        lab = f"vx{i}"
        chains.append(
            f"[{prev_v}][{i}:v]xfade=transition={transition}:duration={td:.3f}:"
            f"offset={offset:.3f}[{lab}]"
        )
        prev_v = lab
    if has_audio:
        prev_a = "0:a"
        for i in range(1, len(segments)):
            lab = f"ax{i}"
            chains.append(f"[{prev_a}][{i}:a]acrossfade=d={td:.3f}:c1=tri:c2=tri[{lab}]")
            prev_a = lab
        tail = _post(prev_v, post_filters)
        graph = ";".join(chains) + ";" + tail
        maps = ["-map", "[vout]", "-map", f"[{prev_a}]"]
    else:
        tail = _post(prev_v, post_filters)
        graph = ";".join(chains) + ";" + tail
        maps = ["-map", "[vout]"]

    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y", *inputs,
           "-filter_complex", graph, *maps, "-r", str(preset.fps),
           *_enc_args(preset)]
    cmd += preset.audio_args() if has_audio else ["-an"]
    cmd += ["-movflags", "+faststart", str(out)]
    run(cmd, timeout=14400, check=True, env=font_env)
    return out


def _post(last_label: str, post_filters: list[str] | None) -> str:
    """Chain optional post filters (e.g. subtitles) onto the joined stream."""
    filters = list(post_filters or []) + ["format=yuv420p"]
    return f"[{last_label}]" + ",".join(filters) + "[vout]"


def concat_demuxer(files: list[str | Path], out: str | Path, *,
                   preset: VideoPreset) -> Path:
    """Lossless stream-copy join - use when all parts share identical params."""
    out = _ensure_parent(Path(out))
    lst = out.parent / f"_{out.stem}_concat.txt"
    lst.write_text("".join(f"file '{Path(f).resolve()}'\n" for f in files))
    run([_ff(), "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
         "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart",
         str(out)], timeout=7200, check=True)
    return out


# --------------------------------------------------------------------------- #
#  audio attachment
# --------------------------------------------------------------------------- #
def mux_audio(video: str | Path, audio: str | Path, out: str | Path, *,
              preset: VideoPreset, shortest: bool = False) -> Path:
    out = _ensure_parent(Path(out))
    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y",
           "-i", str(video), "-i", str(audio),
           "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "copy", *preset.audio_args(),
           "-movflags", "+faststart"]
    if shortest:
        cmd += ["-shortest"]
    cmd += [str(out)]
    run(cmd, timeout=7200, check=True)
    return out


def replace_audio_video(video: str | Path, audio: str | Path, out: str | Path, *,
                        preset: VideoPreset, crf: int | None = None) -> Path:
    """Re-encode video while attaching new audio (used for the final master)."""
    out = _ensure_parent(Path(out))
    run([_ff(), "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(video), "-i", str(audio),
         "-map", "0:v:0", "-map", "1:a:0",
         *_enc_args(preset, crf=crf), *preset.audio_args(),
         "-movflags", "+faststart", str(out)], timeout=14400, check=True)
    return out


def build_narration_track(entries: list[tuple[str | Path, float]], out: str | Path, *,
                          total: float, sample_rate: int = 48000) -> Path:
    """Place voiceover clips at exact timeline offsets and render one stem.

    entries = [(voice_file, offset_seconds), ...]
    """
    out = _ensure_parent(Path(out))
    if not entries:
        from .audio import silence

        return silence(total, out)
    entries = [(Path(p), float(t)) for p, t in entries if Path(p).exists()]
    if not entries:
        from .audio import silence

        return silence(total, out)

    cmd = [_ff(), "-hide_banner", "-loglevel", "error", "-y"]
    for p, _ in entries:
        cmd += ["-i", str(p)]
    parts = []
    labels = []
    for i, (_, t) in enumerate(entries):
        ms = max(0, int(round(t * 1000)))
        parts.append(
            f"[{i}:a]aformat=sample_fmts=fltp:sample_rates={sample_rate}:channel_layouts=stereo,"
            f"adelay={ms}|{ms},apad[a{i}]"
        )
        labels.append(f"[a{i}]")
    graph = ";".join(parts) + ";"
    graph += "".join(labels) + f"amix=inputs={len(entries)}:duration=longest:normalize=0,"
    graph += f"atrim=0:{total:.3f},alimiter=limit=0.98[aout]"
    cmd += ["-filter_complex", graph, "-map", "[aout]", "-t", f"{total:.3f}",
            "-c:a", "pcm_s16le", "-ar", str(sample_rate), "-ac", "2", str(out)]
    run(cmd, timeout=7200, check=True)
    return out


# --------------------------------------------------------------------------- #
#  final packaging
# --------------------------------------------------------------------------- #
def final_encode(src: str | Path, out: str | Path, *, preset: VideoPreset,
                 crf: int | None = None, two_pass: bool = False,
                 target_mb: float | None = None) -> Path:
    """Master encode with YouTube's recommended muxing (+ optional size cap)."""
    out = _ensure_parent(Path(out))
    info = probe(src)
    args = _enc_args(preset, crf=crf)
    audio = preset.audio_args()
    if target_mb:
        dur = max(1e-3, info.duration)
        total_kbps = (target_mb * 8 * 1024) / dur
        audio_kbps = float(preset.audio_bitrate.rstrip("k"))
        video_kbps = max(300, total_kbps - audio_kbps)
        args = ["-c:v", "libx264", "-preset", preset.x264_preset,
                "-b:v", f"{video_kbps:.0f}k", "-maxrate", f"{video_kbps*1.2:.0f}k",
                "-bufsize", f"{video_kbps*2:.0f}k", "-pix_fmt", preset.pixel_format,
                "-profile:v", preset.profile, "-level", preset.level,
                "-g", str(int(preset.fps * preset.gop_seconds))]
    if two_pass:
        passlog = str((out.parent / f"_{out.stem}_2pass").resolve())
        common = [_ff(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                  *args, "-passlogfile", passlog, "-an", "-f", "mp4", os.devnull]
        run(common + ["-pass", "1"], timeout=14400, check=True)
        run([_ff(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
             *args, "-pass", "2", "-passlogfile", passlog, *audio,
             "-movflags", "+faststart", str(out)], timeout=14400, check=True)
        return out
    run([_ff(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         *args, *audio, *preset.mux_args(), str(out)], timeout=14400, check=True)
    return out


def extract_poster(video: str | Path, out_png: str | Path, at: float = 1.0) -> Path:
    from .probe import frame_grab

    return frame_grab(video, at, out_png)


def gif_preview(video: str | Path, out_gif: str | Path, *, start: float = 0.0,
                dur: float = 4.0, width: int = 640, fps: int = 12) -> Path:
    out = _ensure_parent(Path(out_gif))
    run([_ff(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{start}", "-t", f"{dur}",
         "-i", str(video), "-vf",
         f"fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse",
         str(out)], timeout=1800, check=True)
    return out


def contact_sheet(video: str | Path, out_png: str | Path, *, cols: int = 4,
                  rows: int = 3, width: int = 480) -> Path:
    """One PNG showing evenly spaced frames - fast visual QA of the master."""
    out = _ensure_parent(Path(out_png))
    dur = duration(video)
    n = cols * rows
    step = max(0.1, dur / (n + 1))
    tmp = out.parent / "_thumbs"
    tmp.mkdir(exist_ok=True)
    frames: list[Path] = []
    for i in range(n):
        p = tmp / f"f{i:02d}.png"
        run([_ff(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{step*(i+1):.3f}",
             "-i", str(video), "-frames:v", "1", "-vf", f"scale={width}:-1", str(p)],
            timeout=600)
        if p.exists():
            frames.append(p)
    if not frames:
        raise RuntimeError("could not extract frames")
    run([_ff(), "-hide_banner", "-loglevel", "error", "-y",
         "-pattern_type", "glob", "-i", str(tmp / "f*.png"),
         "-filter_complex", f"tile={cols}x{rows}:padding=6:margin=6:color=0x101018",
         "-frames:v", "1", str(out)], timeout=900, check=True)
    return out


def write_manifest(path: str | Path, data: dict) -> Path:
    path = _ensure_parent(Path(path))
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def ffmpeg_command_preview(args: list) -> str:
    return " ".join(str(a) for a in args)
