"""Offline text-to-speech through the espeak-ng shared library.

`espeakng-loader` (PyPI) ships ``libespeak-ng.so`` plus its voice data, so we
can synthesise speech with ``ctypes`` without any system package, root access
or model download.

Quality note: espeak-ng is a *formant* synthesiser - perfectly intelligible,
but robotic. It exists here so the narration pipeline can be exercised end to
end and so a *rough scratch VO* can drive timing decisions. For publishable
audio use a recorded VO, a neural TTS (Piper with a downloaded voice, or a
paid API); `ytstudio.audio.tts()` prefers those when configured.
"""

from __future__ import annotations

import ctypes
import ctypes.util
import os
from array import array
from pathlib import Path

AUDIO_OUTPUT_RETRIEVAL = 1
AUDIO_OUTPUT_SYNCHRONOUS = 2
POS_CHARACTER = 1
CHARS_UTF8 = 1
PARAM_RATE = 1
PARAM_VOLUME = 2
PARAM_PITCH = 3
PARAM_RANGE = 4
PARAM_GAP = 5

SAMPLE_RATE = 22050


class _Library:
    _instance = None

    @classmethod
    def get(cls):
        if cls._instance is None:
            cls._instance = cls._load()
        return cls._instance

    @staticmethod
    def _load():
        lib = None
        data_path = None
        try:  # preferred: PyPI wheel that bundles the .so + voice data
            import espeakng_loader as loader

            lib = ctypes.CDLL(str(loader.get_library_path()))
            data_path = str(loader.get_data_path())
        except Exception:
            for name in ("libespeak-ng.so.1", "libespeak-ng.so", "espeak-ng"):
                cand = ctypes.util.find_library(name) or name
                try:
                    lib = ctypes.CDLL(cand)
                    data_path = os.environ.get("ESPEAK_DATA_PATH",
                                               "/usr/lib/x86_64-linux-gnu/espeak-ng-data")
                    break
                except OSError:
                    continue
        if lib is None:
            raise RuntimeError("espeak-ng library not found (pip install espeakng-loader)")

        lib.espeak_Initialize.restype = ctypes.c_int
        lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int,
                                          ctypes.c_char_p, ctypes.c_int]
        lib.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
        lib.espeak_Synth.restype = ctypes.c_int
        lib.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint,
                                     ctypes.c_int, ctypes.c_uint, ctypes.c_uint,
                                     ctypes.POINTER(ctypes.c_uint), ctypes.c_void_p]
        lib.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
        lib.espeak_Synchronize.restype = ctypes.c_int
        lib.espeak_ListVoices.restype = ctypes.c_void_p
        return lib, data_path

    @classmethod
    def initialized(cls):
        lib, data_path = cls.get()
        if lib.espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0,
                                 (data_path or "").encode() or None, 0) < 0:
            raise RuntimeError("espeak_Initialize failed")
        return lib


def available() -> bool:
    try:
        _Library.initialized()
        return True
    except Exception:
        return False


def list_voices() -> list[str]:
    """Best-effort voice listing (parsed from the voice files on disk)."""
    try:
        _, data_path = _Library.get()
        d = Path(data_path) / "voices" / "!v"
        if d.is_dir():
            return sorted(p.stem for p in d.glob("*"))
    except Exception:
        pass
    return []


def synthesize(text: str, out_wav: str | Path, *, voice: str = "en-us",
               rate: int = 160, pitch: int = 48, volume: int = 150,
               gap: int = 6) -> Path:
    """Render `text` to a 22.05 kHz mono WAV using espeak-ng."""
    lib = _Library.initialized()
    buf = array("h")

    CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short),
                                ctypes.c_int, ctypes.c_void_p)

    def _cb(wav, numsamples, events):
        if numsamples > 0:
            buf.extend(ctypes.cast(wav, ctypes.POINTER(ctypes.c_short))[:numsamples])
        return 0

    callback = CALLBACK(_cb)   # must stay referenced for the duration of the call
    lib.espeak_SetSynthCallback(callback)
    lib.espeak_SetParameter(PARAM_RATE, rate, 0)
    lib.espeak_SetParameter(PARAM_PITCH, pitch, 0)
    lib.espeak_SetParameter(PARAM_VOLUME, volume, 0)
    lib.espeak_SetParameter(PARAM_GAP, gap, 0)

    if lib.espeak_SetVoiceByName(voice.encode()) != 0:
        lib.espeak_SetVoiceByName(b"en")

    data = text.encode("utf-8")
    rc = lib.espeak_Synth(data, len(data) + 1, 0, POS_CHARACTER, 0, CHARS_UTF8,
                          None, None)
    if rc != 0:
        raise RuntimeError(f"espeak_Synth failed (rc={rc})")
    lib.espeak_Synchronize()

    if not buf:
        raise RuntimeError("espeak produced no audio")

    out_wav = Path(out_wav)
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    import wave

    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(buf.tobytes())
    return out_wav


if __name__ == "__main__":  # quick manual test
    import sys

    print("available:", available(), "| voices:", list_voices()[:8])
    p = synthesize("This is a test of the offline speech synthesiser.", "/tmp/tts_test.wav")
    print("wrote", p, p.stat().st_size, "bytes")
