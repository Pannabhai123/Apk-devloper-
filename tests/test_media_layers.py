"""Tests for the subtitle, audio and graphics layers."""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from ytstudio import audio, graphics, subtitles
from ytstudio.presets import get_preset
from ytstudio.probe import probe
from ytstudio.render import (compose_still_clip, concat_segments, kenburns_filter,
                             still_to_clip)


# --------------------------------------------------------------------------- #
#  subtitles
# --------------------------------------------------------------------------- #
def test_srt_roundtrip(tmp_path):
    cues = [subtitles.Cue(0.5, 2.0, "First line"),
            subtitles.Cue(2.2, 4.75, "Second line\nwith a break")]
    p = subtitles.write_srt(cues, tmp_path / "a.srt")
    back = subtitles.read_srt(p)
    assert len(back) == 2
    assert abs(back[0].start - 0.5) < 0.001
    assert abs(back[1].end - 4.75) < 0.001
    assert back[1].text.startswith("Second line")


def test_srt_time_formatting():
    cues = [subtitles.Cue(3661.25, 3662.5, "x")]
    text = subtitles.write_srt(cues, "/tmp/_t.srt").read_text()
    assert "01:01:01,250 --> 01:01:02,500" in text


def test_vtt_and_ass_written(tmp_path):
    cues = [subtitles.Cue(0, 1.5, "Hello <b>world</b>")]
    vtt = subtitles.write_vtt(cues, tmp_path / "a.vtt").read_text()
    ass = subtitles.write_ass(cues, tmp_path / "a.ass", width=1920, height=1080)
    body = ass.read_text()
    assert vtt.startswith("WEBVTT")
    assert "PlayResX: 1920" in body and "Dialogue: 0,0:00:00.00,0:00:01.50" in body
    assert "Style: Default" in body


def test_cues_from_text_fills_window():
    cues = subtitles.cues_from_text("Sentence one. Sentence two. Sentence three.", 2.0, 9.0)
    assert len(cues) == 3
    assert abs(cues[0].start - 2.0) < 0.01
    assert cues[-1].end <= 11.05
    assert all(c.duration > 0.1 for c in cues)
    # no overlap
    for a, b in zip(cues, cues[1:]):
        assert b.start >= a.end - 0.001


def test_long_sentence_is_split():
    text = ("This is a deliberately long sentence that should be broken into several "
            "caption chunks, because nobody wants a four line subtitle covering the "
            "bottom third of the frame on a phone screen.")
    chunks = audio.split_script(text, max_chars=60)
    assert len(chunks) > 1
    assert max(len(c) for c in chunks) <= 60


def test_subtitle_style_scales_with_resolution():
    s = subtitles.DEFAULT_STYLE
    big = s.scaled(3840, 2160)
    assert big.font_size == s.font_size * 2
    assert big.margin_v == s.margin_v * 2


def test_transcribe_without_model_gives_clear_error():
    with pytest.raises(RuntimeError) as exc:
        subtitles.transcribe(audio="/tmp/none.wav")
    assert "faster-whisper" in str(exc.value)


# --------------------------------------------------------------------------- #
#  audio
# --------------------------------------------------------------------------- #
def test_synth_music_bed_is_audible_and_loops(tmp_path):
    p = audio.synth_music_bed(4.0, tmp_path / "bed.wav", style="calm")
    data, sr = audio.read_wav(p)
    assert sr == audio.SR
    assert abs(len(data) / sr - 4.0) < 0.2
    assert np.abs(data).max() > 0.05
    # fades: edges must be quieter than the middle
    edge = np.abs(data[: sr // 4]).mean()
    mid = np.abs(data[2 * sr: 3 * sr]).mean()
    assert edge < mid


def test_synth_sfx_kinds(tmp_path):
    for kind in ("whoosh", "pop", "riser", "chime", "impact"):
        p = audio.synth_sfx(kind, tmp_path / f"{kind}.wav")
        assert p.exists() and p.stat().st_size > 1000


def test_mix_voice_music_creates_full_length(tmp_path):
    voice = audio.silence(2.0, tmp_path / "v.wav")
    music = audio.synth_music_bed(6.0, tmp_path / "m.wav")
    out = audio.mix_voice_music(voice, music, tmp_path / "mix.wav", duration=5.0)
    info = probe(out)
    assert abs(info.duration - 5.0) < 0.2
    assert info.channels == 2


def test_normalisation_hits_target(tmp_path):
    music = audio.synth_music_bed(4.0, tmp_path / "m.wav")
    loud = audio.normalize_audio(music, tmp_path / "n.wav", target_i=-14.0)
    measured = float(audio.measure_loudness(loud).get("input_i", 0) or 0)
    assert -17.0 <= measured <= -11.0, measured


def test_narration_track_places_clips_at_offsets(tmp_path):
    from ytstudio.render import build_narration_track

    a = audio.synth_sfx("chime", tmp_path / "a.wav", duration=0.5)
    b = audio.synth_sfx("pop", tmp_path / "b.wav", duration=0.3)
    track = build_narration_track([(a, 0.5), (b, 2.0)], tmp_path / "n.wav", total=3.0)
    data, sr = audio.read_wav(track)
    assert abs(len(data) / sr - 3.0) < 0.15
    # energy near the two placements, silence at the very start
    assert np.abs(data[: int(0.3 * sr)]).max() < 0.05
    assert np.abs(data[int(0.5 * sr): int(0.9 * sr)]).max() > 0.05
    assert np.abs(data[int(2.0 * sr): int(2.3 * sr)]).max() > 0.02


def test_tts_engines_reported():
    engines = audio.tts_available()
    assert "espeak-ng(lib)" in engines


def test_offline_tts_produces_speech(tmp_path):
    from ytstudio import tts_espeak

    if not tts_espeak.available():
        pytest.skip("espeak-ng library unavailable")
    p = audio.tts("Testing one two three.", tmp_path / "vo.wav", engine="espeak-ng(lib)")
    info = probe(p)
    assert info.has_audio and info.duration > 0.8


def test_estimate_speech_seconds_sane():
    assert 2.0 < audio.estimate_speech_seconds("This is a short test sentence.") < 6.0


# --------------------------------------------------------------------------- #
#  graphics
# --------------------------------------------------------------------------- #
def test_background_and_cards_are_full_frame(tmp_path):
    size = (1920, 1080)
    imgs = {
        "bg": graphics.background(size),
        "title": graphics.title_text_png("Hello World", size),
        "lower": graphics.lower_third_png("Ada Lovelace", "Mathematician", size),
        "chapter": graphics.chapter_card("01", "The beginning", size),
        "end": graphics.end_screen_png(size),
        "thumb": graphics.thumbnail((1280, 720), title="Big thumbnail text"),
    }
    for name, img in imgs.items():
        assert img.size == (size if name != "thumb" else (1280, 720)), name
        p = graphics.save_png(img, tmp_path / f"{name}.png")
        assert p.stat().st_size > 1000, name


def test_title_text_is_actually_drawn(tmp_path):
    """A blank overlay is the classic silent failure - assert real pixels."""
    img = graphics.title_text_png("Visible", (640, 360), font_px=60)
    alpha = np.array(img.split()[-1])
    assert alpha.max() > 200
    assert (alpha > 40).sum() > 2000


def test_bullets_reveal_progressively():
    steps = graphics.bullets_png("Head", ["one", "two", "three"], (960, 540))
    assert len(steps) == 3
    coverage = [np.array(s.split()[-1]).sum() for s in steps]
    assert coverage[0] < coverage[1] < coverage[2]


def test_fit_cover_exact_size():
    src = Image.new("RGB", (400, 200), "red")
    out = graphics.fit_cover(src, (1000, 1000))
    assert out.size == (1000, 1000)


# --------------------------------------------------------------------------- #
#  render primitives
# --------------------------------------------------------------------------- #
def test_kenburns_filter_expression():
    vf = kenburns_filter(1920, 1080, 30, 5.0, "zoom_in")
    assert "zoompan" in vf and "scale=3840:2160" in vf and "fps=30" in vf
    assert "zoompan" in kenburns_filter(1920, 1080, 30, 5.0, "pan_left")


def test_still_to_clip_duration_matches(tmp_path):
    preset = get_preset("draft-720p30")
    img = graphics.save_png(graphics.background((1280, 720)), tmp_path / "b.png")
    clip = still_to_clip(img, tmp_path / "c.mp4", dur=2.5, preset=preset, motion="zoom_in")
    info = probe(clip)
    assert abs(info.duration - 2.5) < 0.2
    assert (info.width, info.height) == (1280, 720)
    assert abs(info.fps - 30) < 0.01


def test_compose_still_clip_with_overlay(tmp_path):
    preset = get_preset("draft-720p30")
    bg = graphics.save_png(graphics.background((1280, 720)), tmp_path / "b.png")
    ov = graphics.save_png(graphics.title_text_png("Animated", (1280, 720), font_px=80),
                           tmp_path / "o.png")
    clip = compose_still_clip(bg, tmp_path / "c.mp4", preset=preset, dur=1.5,
                              overlays=[(ov, 0.2, 1.4, "up", 40)])
    info = probe(clip)
    assert abs(info.duration - 1.5) < 0.2


def test_concat_with_crossfade_shortens_timeline(tmp_path):
    preset = get_preset("draft-720p30")
    img = graphics.save_png(graphics.background((1280, 720)), tmp_path / "b.png")
    clips = [still_to_clip(img, tmp_path / f"c{i}.mp4", dur=2.0, preset=preset,
                           motion="none") for i in range(3)]
    out = concat_segments(clips, tmp_path / "joined.mp4", preset=preset,
                          transition="fade", transition_duration=0.5)
    info = probe(out)
    assert info.has_audio is False
    assert abs(info.duration - 5.0) < 0.35  # 6s minus two 0.5s overlaps
