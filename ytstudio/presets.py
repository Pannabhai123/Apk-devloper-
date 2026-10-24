"""Reusable YouTube export presets.

These map 1:1 onto FFmpeg options and are the single source of truth for
resolution / fps / codec settings used by every renderer in the package.
Numbers follow YouTube's own "recommended upload encoding settings".
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field, asdict


@dataclass
class VideoPreset:
    name: str
    width: int
    height: int
    fps: int
    # --- video encoding ---
    codec: str = "libx264"
    crf: int = 18               # visually lossless-ish for upload
    x264_preset: str = "medium"
    profile: str = "high"
    level: str = "4.2"
    pixel_format: str = "yuv420p"
    max_bitrate: str | None = None      # e.g. "16M" for capped VBR
    gop_seconds: float = 2.0
    # --- audio encoding ---
    audio_codec: str = "aac"
    audio_bitrate: str = "320k"
    sample_rate: int = 48000
    channels: int = 2
    loudness_target: float = -14.0      # LUFS integrated (YouTube normalises here)
    true_peak: float = -1.5
    # --- container ---
    container: str = "mp4"
    faststart: bool = True
    extra_args: list = field(default_factory=list)

    @property
    def size(self):
        return f"{self.width}x{self.height}"

    @property
    def aspect(self) -> str:
        from math import gcd

        g = gcd(self.width, self.height)
        return f"{self.width // g}:{self.height // g}"

    def x264_args(self) -> list[str]:
        args = [
            "-c:v", self.codec,
            "-preset", self.x264_preset,
            "-crf", str(self.crf),
            "-profile:v", self.profile,
            "-level", self.level,
            "-pix_fmt", self.pixel_format,
            "-g", str(int(self.fps * self.gop_seconds)),
            "-keyint_min", str(int(self.fps * self.gop_seconds)),
            "-sc_threshold", "0",
        ]
        if self.max_bitrate:
            args += ["-maxrate", self.max_bitrate, "-bufsize", _double_bitrate(self.max_bitrate)]
        return args

    def audio_args(self) -> list[str]:
        return [
            "-c:a", self.audio_codec,
            "-b:a", self.audio_bitrate,
            "-ar", str(self.sample_rate),
            "-ac", str(self.channels),
        ]

    def mux_args(self) -> list[str]:
        args = ["-movflags", "+faststart"] if self.faststart else []
        return args + list(self.extra_args)

    def as_dict(self) -> dict:
        return asdict(self)


def _double_bitrate(br: str) -> str:
    try:
        if br.endswith("M"):
            return f"{float(br[:-1]) * 2:g}M"
        if br.endswith("k"):
            return f"{int(float(br[:-1]) * 2)}k"
    except ValueError:
        pass
    return br


# --------------------------------------------------------------------------- #
#  The preset catalogue
# --------------------------------------------------------------------------- #
_BASE = dict(
    codec="libx264",
    x264_preset="medium",
    profile="high",
    pixel_format="yuv420p",
    audio_codec="aac",
    audio_bitrate="320k",
    sample_rate=48000,
    channels=2,
    loudness_target=-14.0,
    true_peak=-1.5,
    container="mp4",
    faststart=True,
)

def _mk(name: str, width: int, height: int, fps: int, **kw) -> VideoPreset:
    """Build a preset from the shared base plus per-preset overrides."""
    return VideoPreset(name=name, width=width, height=height, fps=fps,
                       **{**_BASE, **kw})


PRESETS: dict[str, VideoPreset] = {
    # ---- primary target: 1080p30 long-form ---------------------------------
    "youtube-1080p30": _mk("youtube-1080p30", 1920, 1080, 30,
                           crf=18, x264_preset="medium", level="4.1",
                           max_bitrate="12M"),
    "youtube-1080p60": _mk("youtube-1080p60", 1920, 1080, 60,
                           crf=18, x264_preset="medium", level="4.2",
                           max_bitrate="18M"),
    "youtube-1440p30": _mk("youtube-1440p30", 2560, 1440, 30,
                           crf=19, x264_preset="medium", level="5.0",
                           max_bitrate="24M"),
    # ---- 4K: only sensible on strong hardware / capable source --------------
    "youtube-4k30": _mk("youtube-4k30", 3840, 2160, 30,
                        crf=20, x264_preset="slow", level="5.2",
                        max_bitrate="53M"),
    "youtube-4k60": _mk("youtube-4k60", 3840, 2160, 60,
                        crf=20, x264_preset="slow", level="5.2",
                        max_bitrate="80M"),
    # ---- preview / draft (fast iteration on slow CPUs) ---------------------
    "draft-720p30": _mk("draft-720p30", 1280, 720, 30,
                        crf=26, x264_preset="veryfast", level="3.1"),
    # ---- vertical short (not the focus, but useful for channel promos) ------
    "shorts-1080x1920": _mk("shorts-1080x1920", 1080, 1920, 30,
                            crf=18, x264_preset="medium", level="4.2",
                            max_bitrate="12M"),
    # ---- archival intermediate for scene rendering (no quality loss) -------
    "intermediate-1080p30": _mk("intermediate-1080p30", 1920, 1080, 30,
                                crf=12, x264_preset="veryfast",
                                audio_codec="pcm_s16le", audio_bitrate="1536k",
                                faststart=False),
}

DEFAULT_PRESET = "youtube-1080p30"


def get_preset(name: str | None) -> VideoPreset:
    if not name:
        name = DEFAULT_PRESET
    if name not in PRESETS:
        raise KeyError(f"unknown preset {name!r}; available: {', '.join(PRESETS)}")
    return deepcopy(PRESETS[name])


def intermediate_for(preset: VideoPreset) -> VideoPreset:
    """Scene intermediates must match the delivery resolution & fps."""
    p = deepcopy(PRESETS["intermediate-1080p30"])
    p.name = f"intermediate-{preset.width}x{preset.height}@{preset.fps}"
    p.width, p.height, p.fps = preset.width, preset.height, preset.fps
    p.container = "mp4"
    return p


def hardware_variant(preset: VideoPreset) -> VideoPreset | None:
    """Return an NVENC/VAAPI/VideoToolbox twin of a preset when a GPU exists."""
    from .tools import hwaccel_available, has_encoder

    hw = hwaccel_available()
    p = deepcopy(preset)
    if hw["nvenc"] and has_encoder("h264_nvenc"):
        p.codec = "h264_nvenc"
        p.extra_args = ["-rc", "vbr", "-cq", str(preset.crf + 2), "-b:v", "0"]
        p.name = preset.name + "+nvenc"
        return p
    if hw["videotoolbox"] and has_encoder("h264_videotoolbox"):
        p.codec = "h264_videotoolbox"
        p.extra_args = ["-q:v", "60"]
        p.name = preset.name + "+videotoolbox"
        return p
    if hw["vaapi"] and has_encoder("h264_vaapi"):
        p.codec = "h264_vaapi"
        p.extra_args = ["-qp", str(preset.crf)]
        p.name = preset.name + "+vaapi"
        return p
    return None
