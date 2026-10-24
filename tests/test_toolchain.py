"""Tests for tool discovery, presets and media probing.

Run with:  .venv/bin/python -m pytest tests -v
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from ytstudio import presets, probe, tools


# --------------------------------------------------------------------------- #
#  toolchain
# --------------------------------------------------------------------------- #
def test_ffmpeg_found_and_has_required_codecs():
    assert tools.ffmpeg() is not None, "FFmpeg missing - run ./bootstrap.sh"
    caps = tools.ffmpeg_capabilities()
    for enc in ("libx264", "aac"):
        assert tools.has_encoder(enc), f"missing encoder {enc}"
    for flt in ("scale", "overlay", "xfade", "subtitles", "loudnorm"):
        assert tools.has_filter(flt), f"missing filter {flt}"


def test_ffprobe_available():
    assert tools.ffprobe() is not None


def test_fonts_resolve_without_system_fonts():
    regular = tools.find_font(None, weight="regular")
    bold = tools.find_font(None, weight="bold")
    assert regular.exists() and bold.exists()
    assert regular.suffix.lower() in (".ttf", ".otf")


def test_fontconfig_points_at_repo_fonts():
    env = tools.fontconfig_env()
    conf = Path(env["FONTCONFIG_FILE"])
    assert conf.exists()
    assert "fonts" in conf.read_text()


def test_doctor_report_has_no_failures():
    rep = tools.doctor()
    failed = [r for r in rep.rows if r[0] == "FAIL"]
    assert not failed, f"environment failures: {failed}"


# --------------------------------------------------------------------------- #
#  presets
# --------------------------------------------------------------------------- #
def test_default_preset_matches_youtube_spec():
    p = presets.get_preset("youtube-1080p30")
    assert (p.width, p.height, p.fps) == (1920, 1080, 30)
    assert p.aspect == "16:9"
    assert p.codec == "libx264"
    assert p.audio_codec == "aac"
    assert p.container == "mp4"
    args = p.x264_args() + p.audio_args() + p.mux_args()
    assert "-c:v" in args and "-crf" in args and "+faststart" in args


def test_4k_preset_available():
    p = presets.get_preset("youtube-4k30")
    assert (p.width, p.height) == (3840, 2160)


def test_unknown_preset_raises():
    with pytest.raises(KeyError):
        presets.get_preset("nope-9000")


def test_intermediate_matches_delivery_resolution():
    p = presets.get_preset("youtube-1440p30")
    i = presets.intermediate_for(p)
    assert (i.width, i.height, i.fps) == (p.width, p.height, p.fps)


# --------------------------------------------------------------------------- #
#  probing (both ffprobe and the ffmpeg fallback)
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def tone(tmp_path_factory):
    out = tmp_path_factory.mktemp("media") / "tone.mp4"
    subprocess.run(
        [str(tools.ffmpeg()), "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25:duration=2",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
         "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-shortest", str(out)], check=True)
    return out


def test_probe_reads_streams(tone):
    info = probe.probe(tone)
    assert info.has_video and info.has_audio
    assert (info.width, info.height) == (320, 240)
    assert abs(info.fps - 25) < 0.01
    assert abs(info.duration - 2.0) < 0.2
    assert info.acodec == "aac"


def test_probe_ffmpeg_fallback(tone, monkeypatch):
    monkeypatch.setattr(probe, "ffprobe", lambda: None)
    info = probe.probe(tone)
    assert info.has_video and info.has_audio
    assert (info.width, info.height) == (320, 240)
    assert abs(info.duration - 2.0) < 0.3


def test_verify_reports_failures_honestly(tone):
    ok = probe.verify(tone, width=320, height=240, fps=25, require_audio=True)
    assert ok["passed"]
    bad = probe.verify(tone, width=1920, height=1080)
    assert not bad["passed"]
    assert any("resolution" in c[0] and not c[1] for c in bad["checks"])


def test_frame_grab_produces_decodable_png(tone, tmp_path):
    p = probe.frame_grab(tone, 1.0, tmp_path / "f.png")
    assert p.exists() and p.stat().st_size > 1000
    from PIL import Image

    assert Image.open(p).size == (320, 240)


def test_probe_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        probe.probe(tmp_path / "nope.mp4")
