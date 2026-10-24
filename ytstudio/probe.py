"""Media probing - ffprobe when available, graceful FFmpeg-stderr fallback."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .tools import ffmpeg, ffprobe, run


@dataclass
class MediaInfo:
    path: str
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 0.0
    vcodec: str = ""
    acodec: str = ""
    sample_rate: int = 0
    channels: int = 0
    bit_rate: int = 0
    size_bytes: int = 0
    has_audio: bool = False
    has_video: bool = False
    raw: dict = field(default_factory=dict)

    @property
    def resolution(self) -> str:
        return f"{self.width}x{self.height}"

    def summary(self) -> str:
        bits = [f"{Path(self.path).name}", f"{self.duration:.2f}s"]
        if self.has_video:
            bits.append(f"{self.resolution} @ {self.fps:.3f} fps {self.vcodec}")
        if self.has_audio:
            bits.append(f"{self.acodec} {self.sample_rate}Hz {self.channels}ch")
        return " | ".join(bits)


def probe(path: str | Path) -> MediaInfo:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    info = MediaInfo(path=str(path), size_bytes=path.stat().st_size)
    exe = ffprobe()
    if exe:
        res = run([exe, "-v", "error", "-print_format", "json",
                   "-show_format", "-show_streams", str(path)], timeout=120)
        if res.returncode == 0 and res.stdout:
            _from_json(info, json.loads(res.stdout))
            return info
    _from_ffmpeg_stderr(info, path)
    return info


def _rate(text: str) -> float:
    if not text or text in ("0/0", "N/A"):
        return 0.0
    if "/" in text:
        num, den = text.split("/")
        try:
            return float(num) / float(den) if float(den) else 0.0
        except ValueError:
            return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _from_json(info: MediaInfo, data: dict) -> None:
    info.raw = data
    fmt = data.get("format", {})
    info.duration = float(fmt.get("duration") or 0.0)
    info.bit_rate = int(float(fmt.get("bit_rate") or 0))
    for st in data.get("streams", []):
        kind = st.get("codec_type")
        if kind == "video" and not info.has_video:
            info.has_video = True
            info.vcodec = st.get("codec_name", "")
            info.width = int(st.get("width") or 0)
            info.height = int(st.get("height") or 0)
            info.fps = _rate(st.get("r_frame_rate") or st.get("avg_frame_rate") or "")
            if not info.duration:
                info.duration = float(st.get("duration") or 0.0)
        elif kind == "audio" and not info.has_audio:
            info.has_audio = True
            info.acodec = st.get("codec_name", "")
            info.sample_rate = int(st.get("sample_rate") or 0)
            info.channels = int(st.get("channels") or 0)


def _from_ffmpeg_stderr(info: MediaInfo, path: Path) -> None:
    exe = ffmpeg()
    if not exe:
        raise RuntimeError("neither ffprobe nor ffmpeg available for probing")
    res = run([exe, "-hide_banner", "-i", str(path)], timeout=120)
    text = (res.stderr or "") + (res.stdout or "")
    info.raw = {"fallback": True, "stderr": text}
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", text)
    if m:
        h, mi, s = m.groups()
        info.duration = int(h) * 3600 + int(mi) * 60 + float(s)
    m = re.search(r"Video:\s*([a-zA-Z0-9_]+).*?(\d{2,5})x(\d{2,5})", text)
    if m:
        info.has_video = True
        info.vcodec, info.width, info.height = m.group(1), int(m.group(2)), int(m.group(3))
    m = re.search(r"(\d+\.?\d*)\s+fps", text)
    if m:
        info.fps = float(m.group(1))
    m = re.search(r"Audio:\s*([a-zA-Z0-9_]+).*?(\d{4,6})\s*Hz.*?(stereo|mono|(\d+) channels)", text)
    if m:
        info.has_audio = True
        info.acodec = m.group(1)
        info.sample_rate = int(m.group(2))
        info.channels = 2 if m.group(3) == "stereo" else (1 if m.group(3) == "mono" else int(m.group(4)))
    info.bit_rate = int(info.size_bytes * 8 / info.duration) if info.duration else 0


def audio_duration(path: str | Path) -> float:
    return probe(path).duration


def video_duration(path: str | Path) -> float:
    return probe(path).duration


def verify(path: str | Path, *, width=None, height=None, fps=None, min_duration=None,
           max_duration=None, require_audio=True, duration_tolerance=0.6) -> dict:
    """Acceptance check used by `ytv verify` and the demo test-suite."""
    info = probe(path)
    checks: list[tuple[str, bool, str]] = []

    exists = Path(path).exists() and info.size_bytes > 0
    checks.append(("file exists & non-empty", exists, f"{info.size_bytes/2**20:.2f} MiB"))
    checks.append(("video stream present", info.has_video, info.vcodec or "none"))
    if require_audio:
        checks.append(("audio stream present", info.has_audio,
                       f"{info.acodec} {info.sample_rate}Hz {info.channels}ch" if info.has_audio else "none"))
    if width and height:
        checks.append((f"resolution {width}x{height}", (info.width, info.height) == (width, height),
                       info.resolution))
    if fps:
        checks.append((f"frame rate {fps}", abs(info.fps - fps) < 0.05, f"{info.fps:.3f}"))
    if min_duration is not None:
        checks.append((f"duration >= {min_duration:.1f}s", info.duration >= min_duration - duration_tolerance,
                       f"{info.duration:.2f}s"))
    if max_duration is not None:
        checks.append((f"duration <= {max_duration:.1f}s", info.duration <= max_duration + duration_tolerance,
                       f"{info.duration:.2f}s"))

    passed = all(ok for _, ok, _ in checks)
    return {"path": str(path), "info": info, "checks": checks, "passed": passed}


def frame_grab(path: str | Path, at: float, out_png: str | Path) -> Path:
    """Extract one frame - used to prove the file decodes and subtitles are burned in."""
    exe = ffmpeg()
    out_png = Path(out_png)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    run([exe, "-hide_banner", "-loglevel", "error", "-ss", f"{at:.3f}", "-i", str(path),
         "-frames:v", "1", "-y", str(out_png)], timeout=180, check=True)
    return out_png
