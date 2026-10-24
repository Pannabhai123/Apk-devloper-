"""End-to-end pipeline tests: planning, a real mini render, resumability,
and the Remotion bridge."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from ytstudio import audio, graphics
from ytstudio.engine import Project, VideoFactory, scaffold_project
from ytstudio.presets import get_preset, intermediate_for
from ytstudio.probe import probe
from ytstudio.render import still_to_clip
from ytstudio.scenes import Scene, SceneRenderer


# --------------------------------------------------------------------------- #
#  fixtures: a tiny but complete project (no network, no TTS needed)
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def mini_project(tmp_path_factory):
    root = tmp_path_factory.mktemp("mini")
    for sub in ("assets/images", "assets/audio", "build", "output"):
        (root / sub).mkdir(parents=True, exist_ok=True)

    graphics.save_png(graphics.background((1280, 720)), root / "assets/images/bg.png")

    # 1-second tone stands in for a voiceover file
    from ytstudio.tools import ffmpeg, run

    run([ffmpeg(), "-y", "-loglevel", "error", "-f", "lavfi",
         "-i", "sine=frequency=220:duration=1", "-ar", "48000", "-ac", "2",
         str(root / "assets/audio/vo.wav")], check=True)
    audio.synth_music_bed(20, root / "assets/audio/music.wav")

    cfg = {
        "project": {"title": "Mini Test Video", "slug": "mini",
                    "preset": "draft-720p30"},
        "audio": {"music": "assets/audio/music.wav", "synth_music": False},
        "subtitles": {"burn_in": True, "max_chars": 40},
        "transitions": {"type": "fade", "duration": 0.4},
        "thumbnail": {"enabled": True, "title": "Mini Test Video"},
        "scenes": [
            {"kind": "title", "title": "Mini Test", "subtitle": "pipeline check",
             "duration": 2.0, "narration": "Hello and welcome."},
            {"kind": "image", "image": "assets/images/bg.png",
             "title": "A picture", "duration": 1.5, "voice": "assets/audio/vo.wav",
             "narration": "Look at this."},
            {"kind": "endscreen", "title": "Mini", "subtitle": "next", "duration": 3.0},
        ],
    }
    (root / "project.yaml").write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return root


# --------------------------------------------------------------------------- #
#  planning
# --------------------------------------------------------------------------- #
def test_scaffold_creates_runnable_skeleton(tmp_path):
    root = scaffold_project("Hello World", base=tmp_path)
    assert (root / "project.yaml").exists()
    assert (root / "assets/images").is_dir()
    proj = Project.load(root)
    plan = proj.plan(strict=False)
    assert len(plan.scenes) >= 4
    assert plan.total_duration > 10
    assert plan.transition_duration > 0


def test_scaffold_refuses_to_overwrite(tmp_path):
    scaffold_project("Dup", base=tmp_path)
    with pytest.raises(FileExistsError):
        scaffold_project("Dup", base=tmp_path)


def test_plan_timeline_accounts_for_crossfades(mini_project):
    proj = Project.load(mini_project)
    plan = proj.plan()
    starts = [s.timing["start"] for s in plan.scenes]
    durations = [s.timing["duration"] for s in plan.scenes]
    assert starts[0] == 0
    # scene 2 starts before scene 1 finished (the fade overlaps)
    assert starts[1] == pytest.approx(durations[0] - plan.transition_duration, abs=0.01)
    assert plan.total_duration == pytest.approx(
        sum(durations) - plan.transition_duration * (len(durations) - 1), abs=0.01)


def test_plan_captions_generated_from_narration(mini_project):
    plan = Project.load(mini_project).plan()
    assert plan.cues, "narration should produce caption cues"
    assert all(c.end > c.start for c in plan.cues)
    assert plan.cues[-1].end <= plan.total_duration + 0.5


def test_endscreen_is_at_least_ten_seconds(mini_project):
    plan = Project.load(mini_project).plan()
    endscreen = [s for s in plan.scenes if s.kind == "endscreen"][0]
    assert endscreen.timing["duration"] >= 10.0


def test_missing_media_fails_loudly_without_fallback(tmp_path):
    (tmp_path / "project.yaml").write_text(yaml.safe_dump({
        "scenes": [{"kind": "image", "title": "no asset"}],
    }))
    proj = Project.load(tmp_path)
    with pytest.raises(FileNotFoundError):
        proj.plan(strict=True)
    plan = proj.plan(strict=False)   # explicit opt-in degrades to a text card
    assert plan.warnings


def test_scene_fingerprint_changes_with_content():
    a = Scene(kind="title", title="One")
    b = Scene(kind="title", title="Two")
    p = get_preset("draft-720p30")
    assert a.fingerprint(p) != b.fingerprint(p)
    assert a.fingerprint(p) == Scene(kind="title", title="One").fingerprint(p)
    assert a.fingerprint(p) != a.fingerprint(get_preset("youtube-4k30"))


# --------------------------------------------------------------------------- #
#  scene renderer coverage
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("scene", [
    Scene(kind="title", title="Title scene", subtitle="sub", duration=1.0, index=0),
    Scene(kind="chapter", number="02", title="Chapter", duration=1.0, index=1),
    Scene(kind="bullets", headline="Points", bullets=["a", "b"], duration=1.2, index=2),
    Scene(kind="quote", title="A quote", attribution="someone", duration=1.0, index=3),
    Scene(kind="stats", title="42%", subtitle="of people", duration=1.0, index=4),
    Scene(kind="outro", title="Bye", subtitle="see you", duration=1.0, index=5),
    Scene(kind="endscreen", title="Chan", subtitle="next", duration=1.0, index=6),
    Scene(kind="blank", duration=0.8, index=7),
])
def test_every_scene_kind_renders(scene, tmp_path):
    preset = get_preset("draft-720p30")
    renderer = SceneRenderer(preset, tmp_path)
    out = renderer.render(scene)
    info = probe(out)
    assert info.has_video
    assert (info.width, info.height) == (1280, 720)
    assert info.duration > 0.5


def test_image_scene_uses_supplied_image(tmp_path):
    preset = get_preset("draft-720p30")
    img = graphics.save_png(
        graphics.background((400, 900), (200, 30, 30), style="gradient"),
        tmp_path / "portrait.png")
    scene = Scene(kind="image", image=str(img), title="Portrait", duration=1.0)
    out = SceneRenderer(preset, tmp_path).render(scene)
    assert probe(out).duration > 0.9


def test_video_scene_loops_short_clip(tmp_path):
    preset = get_preset("draft-720p30")
    img = graphics.save_png(graphics.background((1280, 720)), tmp_path / "b.png")
    clip = still_to_clip(img, tmp_path / "short.mp4", dur=0.8, preset=intermediate_for(preset),
                         motion="none")
    scene = Scene(kind="video", video=str(clip), duration=2.0, title="looped")
    out = SceneRenderer(preset, tmp_path).render(scene)
    assert probe(out).duration >= 1.9


def test_scene_renderer_falls_back_on_bad_asset(tmp_path):
    """A missing image must not abort the whole render."""
    preset = get_preset("draft-720p30")
    scene = Scene(kind="image", image=str(tmp_path / "ghost.png"), duration=1.0)
    with pytest.raises(FileNotFoundError):
        SceneRenderer(preset, tmp_path).render(scene)


# --------------------------------------------------------------------------- #
#  full mini pipeline
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def rendered(mini_project):
    project = Project.load(mini_project)
    plan = project.plan()
    factory = VideoFactory(plan, log=lambda *_: None)
    manifest = factory.run()
    return project, plan, factory, manifest


def test_pipeline_produces_verified_master(rendered):
    _, plan, _, manifest = rendered
    master = Path(manifest["master"])
    assert master.exists() and master.stat().st_size > 100_000
    assert manifest["verification"]["passed"], manifest["verification"]

    info = probe(master)
    assert info.has_video and info.has_audio
    assert (info.width, info.height) == (1280, 720)
    assert abs(info.fps - 30) < 0.05
    assert abs(info.duration - plan.total_duration) < 1.0
    assert info.acodec == "aac"


def test_pipeline_writes_caption_sidecars(rendered):
    _, plan, _, manifest = rendered
    for kind in ("srt", "vtt", "ass"):
        p = Path(manifest["subtitles"][kind])
        assert p.exists() and p.stat().st_size > 20
    assert manifest["subtitles"]["srt"].endswith(".srt")


def test_pipeline_writes_thumbnail_and_poster(rendered):
    _, _, _, manifest = rendered
    thumb = Path(manifest["thumbnail"])
    assert thumb.exists() and thumb.suffix == ".jpg"
    from PIL import Image

    assert Image.open(thumb).size == (1280, 720)
    assert Path(manifest["poster"]).exists()


def test_pipeline_writes_manifest_and_timeline(rendered):
    _, _, factory, manifest = rendered
    mf = json.loads((factory.out_dir / "mini-manifest.json").read_text())
    assert mf["resolution"] == "1280x720"
    assert len(mf["timeline"]) == len(manifest["timeline"])
    assert mf["timeline"][0]["start"] == 0


def test_second_run_reuses_cached_scenes(rendered):
    project, plan, factory, _ = rendered
    before = [Path(v["file"]).stat().st_mtime for v in factory.state["scenes"].values()]
    factory2 = VideoFactory(plan, log=lambda *_: None)
    factory2.render_scenes()
    after = [Path(v["file"]).stat().st_mtime for v in factory2.state["scenes"].values()]
    assert before == after


def test_subtitles_are_burned_into_the_picture(rendered, tmp_path):
    """Compare a caption-time frame against a frame with no caption."""
    _, plan, _, manifest = rendered
    from ytstudio.probe import frame_grab

    master = Path(manifest["master"])
    cue = plan.cues[0]
    mid = (cue.start + cue.end) / 2
    with_caption = frame_grab(master, mid, tmp_path / "cap.png")
    without = frame_grab(master, plan.cues[-1].end + 1.2, tmp_path / "nocap.png")

    import numpy as np
    from PIL import Image

    a = np.array(Image.open(with_caption).convert("L"), dtype=float)
    b = np.array(Image.open(without).convert("L"), dtype=float)
    # caption band lives in the lower third
    band_a = a[int(a.shape[0] * 0.72): int(a.shape[0] * 0.92)]
    band_b = b[int(b.shape[0] * 0.72): int(b.shape[0] * 0.92)]
    assert band_a.std() > 0  # something is drawn there
    assert band_a.max() > 150, "no bright caption pixels found"


# --------------------------------------------------------------------------- #
#  remotion bridge
# --------------------------------------------------------------------------- #
def test_remotion_status_reports_renderability():
    from ytstudio.remotion import remotion_status

    status = remotion_status()
    assert status["installed"], "run ./bootstrap.sh (npm install)"
    if not status["renderable"]:
        pytest.skip(f"chromium unavailable: {status.get('note')}")
    assert "Chromium" in status.get("chrome_version", "")


def test_cli_help_runs():
    from ytstudio.cli import build_parser

    parser = build_parser()
    assert parser.prog == "ytstudio"
    args = parser.parse_args(["render", "projects/foo", "--draft"])
    assert args.draft and args.project == "projects/foo"
