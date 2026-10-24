"""End-to-end demo: builds a complete project folder, generates its assets and
narrates them, then renders a real video through the production pipeline.

Used by ``python -m ytstudio sample`` and by the test suite. It deliberately
touches every feature: title, chapter, bullet build-up, stills with Ken-Burns
motion, a big-number card, a quote, B-roll, a slideshow, an outro and a
10-second end screen - plus narration, a ducked music bed, burned subtitles,
sidecar captions, a thumbnail and a verified master.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from . import graphics
from .tools import PROJECTS_DIR

DEMO_SLUG = "_demo-youtube-system"
DEMO_TITLE = "Build a YouTube Video Machine"

SCRIPT = [
    # (scene narration, audio filename)
    ("Every good YouTube video gets made twice. Once on paper, and once in software. "
     "This is the software part, running end to end.", "vo_01.wav"),
    ("Here is the pipeline, in the order the files are actually produced.", "vo_02.wav"),
    ("Five stages, and no guesswork: script and storyboard, voice, music and captions, "
     "scene rendering, the YouTube master, and finally the thumbnail and end screen.",
     "vo_03.wav"),
    ("Rendering happens scene by scene. Each scene is written to disk with a fingerprint, "
     "so a crash never costs you the whole render.", "vo_04.wav"),
    ("The master lands exactly on YouTube's recommended profile: one thousand eighty p, "
     "thirty frames per second, H.264 with AAC audio, normalised to minus fourteen LUFS.",
     "vo_05.wav"),
    ("Which brings us to the only rule that survives contact with a real deadline. "
     "Slow is smooth, and smooth is fast.", "vo_06.wav"),
    ("Drop your images, your clips and your voiceover into the assets folder. "
     "Everything else is timing, captions and mix.", "vo_07.wav"),
    ("Photos become moving shots. Captions follow the narration automatically. "
     "And the music ducks itself underneath the voice.", "vo_08.wav"),
    ("That is the whole system. Build it once, then reuse it for every video you make.",
     "vo_09.wav"),
]

YAML_TEMPLATE = """\
project:
  title: "{title}"
  slug: demo
  preset: youtube-1080p30
  resolution: 1920x1080
  fps: 30
  brand:
    channel: "ytstudio"
    accent: "#FFB03B"
  language: en

audio:
  music: assets/audio/music.wav
  music_gain_db: -19
  duck: true
  normalize: true
  target_lufs: -14.0
  true_peak: -1.5
  narration_lead: 0.45

subtitles:
  burn_in: true
  max_chars: 82
  font: Inter-Bold
  font_size: 56
  outline: 3
  shadow: 1
  margin_v: 76

transitions:
  type: fade
  duration: 0.7

thumbnail:
  enabled: true
  title: "Build a YouTube Video Machine"
  subtitle: "the whole pipeline, end to end"
  badge: "SYSTEM"
  image: assets/images/thumb_bg.png

scenes:
  - kind: title
    title: "Build a YouTube Video Machine"
    subtitle: "script · voice · scenes · master"
    motion: zoom_out
    voice: assets/audio/vo_01.wav
    narration: "{n0}"

  - kind: chapter
    number: "01"
    title: "The pipeline"
    subtitle: "files, in the order they are produced"
    motion: zoom_out
    voice: assets/audio/vo_02.wav
    narration: "{n1}"

  - kind: bullets
    headline: "Five stages, no guesswork"
    bullets:
      - "Script and storyboard"
      - "Voice, music and captions"
      - "Scene rendering in FFmpeg"
      - "Master encode for YouTube"
      - "Thumbnail and end screen"
    voice: assets/audio/vo_03.wav
    narration: "{n2}"

  - kind: image
    image: assets/images/chart.png
    title: "Progress is never lost"
    layout: lower
    captions: false            # uses the caption card instead of burned subs
    motion: pan_right
    voice: assets/audio/vo_04.wav
    narration: "{n3}"

  - kind: stats
    title: "1080p30"
    subtitle: "H.264 · AAC 320k · -14 LUFS · safe-area aware"
    motion: zoom_in
    voice: assets/audio/vo_05.wav
    narration: "{n4}"

  - kind: quote
    title: "Slow is smooth. Smooth is fast."
    attribution: "production proverb"
    voice: assets/audio/vo_06.wav
    narration: "{n5}"

  - kind: image
    image: assets/images/diagram.png
    title: "Assets in. Video out."
    layout: center
    motion: zoom_in
    voice: assets/audio/vo_07.wav
    narration: "{n6}"

  - kind: slideshow
    images:
      - assets/images/mesh_a.png
      - assets/images/mesh_b.png
    voice: assets/audio/vo_08.wav
    narration: "{n7}"

  - kind: outro
    title: "Thanks for watching"
    subtitle: "Subscribe for the next build"
    motion: zoom_in
    voice: assets/audio/vo_09.wav
    narration: "{n8}"

  - kind: endscreen
    title: "ytstudio"
    subtitle: "Watch next"
    duration: 10
"""


# --------------------------------------------------------------------------- #
#  generated demo imagery (so the demo needs no downloads)
# --------------------------------------------------------------------------- #
def _chart_png(path: Path, size=(1920, 1080)):
    from PIL import Image, ImageDraw

    img = graphics.background(size, style="grid")
    d = ImageDraw.Draw(img)
    accent, accent2, text, muted = (255, 176, 59), (86, 204, 242), (245, 247, 252), (150, 163, 186)
    from .scenes import _sub_font

    head = _sub_font(58, "bold")
    d.text((210, 130), "Render budget by stage", font=head, fill=text + (255,))
    d.text((210, 210), "seconds of wall-clock time per minute of finished video",
           font=_sub_font(30), fill=muted + (255,))
    rows = [("Scene render", 0.62, accent2), ("Subtitles", 0.28, accent),
            ("Audio mix", 0.14, (140, 226, 160)), ("Master encode", 0.46, accent2),
            ("Verification", 0.05, (200, 180, 255))]
    x0, y0, bar_w = 220, 330, 1080
    for i, (label, frac, col) in enumerate(rows):
        y = y0 + i * 128
        d.text((x0, y + 18), label, font=_sub_font(34), fill=text + (255,))
        d.rounded_rectangle([x0 + 380, y + 14, x0 + 380 + bar_w, y + 66], radius=12,
                            fill=(255, 255, 255, 22))
        d.rounded_rectangle([x0 + 380, y + 14, x0 + 380 + int(bar_w * frac), y + 66],
                            radius=12, fill=col + (230,))
        d.text((x0 + 380 + int(bar_w * frac) + 20, y + 22), f"{frac:.2f}×",
               font=_sub_font(30), fill=muted + (255,))
    graphics.save_png(img, path)


def _diagram_png(path: Path, size=(1920, 1080)):
    from PIL import ImageDraw

    img = graphics.background(size, style="gradient")
    d = ImageDraw.Draw(img)
    from .scenes import _sub_font

    boxes = [("assets/images", "stills"), ("assets/clips", "B-roll"), ("assets/audio", "voice")]
    bw, bh = 380, 170
    y = 250
    for i, (title, sub) in enumerate(boxes):
        x = 200 + i * 430
        panel = graphics.rounded_panel((bw, bh), radius=22, fill=(16, 22, 38, 220),
                                       border=(255, 176, 59, 200), border_width=3)
        img.alpha_composite(panel, (x, y))
        d.text((x + 34, y + 44), title, font=_sub_font(34, "bold"), fill=(245, 247, 252, 255))
        d.text((x + 34, y + 100), sub, font=_sub_font(28), fill=(150, 163, 186, 255))
    # arrow to the output
    d.line([(1580, y + bh // 2), (1680, y + bh // 2)], fill=(255, 176, 59, 255), width=8)
    d.polygon([(1680, y + bh // 2 - 18), (1720, y + bh // 2), (1680, y + bh // 2 + 18)],
              fill=(255, 176, 59, 255))
    out = graphics.rounded_panel((420, 220), radius=24, fill=(86, 204, 242, 40),
                                 border=(86, 204, 242, 220), border_width=3)
    img.alpha_composite(out, (720, 620))
    d.text((790, 690), "final.mp4", font=_sub_font(52, "bold"), fill=(245, 247, 252, 255))
    d.text((830, 770), "1080p30 · AAC", font=_sub_font(26), fill=(150, 163, 186, 255))
    graphics.save_png(img, path)


def _mesh_png(path: Path, seed: int, size=(1920, 1080)):
    import numpy as np
    from PIL import Image

    rng = np.random.default_rng(seed)
    h, w = size[1] // 4, size[0] // 4
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    canvas = np.zeros((h, w, 3), dtype=np.float32)
    for _ in range(7):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(0.2, 0.6) * max(w, h)
        col = rng.choice([[255, 176, 59], [86, 204, 242], [140, 226, 160], [180, 120, 255]])
        g = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
        canvas += g[..., None] * col * rng.uniform(0.35, 0.8)
    canvas = canvas * 0.45 * np.array([0.70, 0.85, 1.25], dtype=np.float32)
    canvas += np.array([6, 9, 17], dtype=np.float32)
    canvas = canvas / max(1.0, canvas.max() / 190.0)
    img = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGB")
    img = img.resize(size, Image.LANCZOS).filter(
        __import__("PIL.ImageFilter", fromlist=["ImageFilter"]).GaussianBlur(2))
    graphics.save_png(img.convert("RGB"), path)


def _thumb_bg(path: Path, size=(1280, 720)):
    _mesh_png(path, seed=42, size=size)


# --------------------------------------------------------------------------- #
#  project + assets
# --------------------------------------------------------------------------- #
def write_demo_project(*, force: bool = False, base: Path | None = None,
                       narrate: bool = True, log=print) -> Path:
    base = base or PROJECTS_DIR
    root = base / DEMO_SLUG
    if root.exists():
        if not force:
            log(f"  demo project already at {root} (use --force to rebuild)")
            return root
        shutil.rmtree(root)
    for sub in ("assets/images", "assets/clips", "assets/audio", "build", "output"):
        (root / sub).mkdir(parents=True, exist_ok=True)

    log("  generating demo imagery…")
    _chart_png(root / "assets/images/chart.png")
    _diagram_png(root / "assets/images/diagram.png")
    _mesh_png(root / "assets/images/mesh_a.png", seed=7)
    _mesh_png(root / "assets/images/mesh_b.png", seed=19)
    _thumb_bg(root / "assets/images/thumb_bg.png")

    log("  synthesising narration (offline espeak-ng)…")
    for i, (text, fname) in enumerate(SCRIPT):
        out = root / "assets/audio" / fname
        if narrate:
            try:
                from .audio import tts

                tts(text, out, engine="espeak-ng(lib)", voice="en-us")
                continue
            except Exception as exc:  # pragma: no cover
                log(f"    ! TTS failed for {fname}: {exc}")
        # no TTS at all: fall back to silent placeholders so the pipeline still runs
        from .audio import estimate_speech_seconds
        from .audio import silence

        silence(estimate_speech_seconds(text), out)

    log("  generating copyright-safe music bed…")
    from .audio import synth_music_bed

    synth_music_bed(240, root / "assets/audio/music.wav", style="calm", bpm=82)

    log("  writing project.yaml…")
    (root / "project.yaml").write_text(
        YAML_TEMPLATE.format(title=DEMO_TITLE, **{f"n{i}": s[0] for i, s in enumerate(SCRIPT)}),
        encoding="utf-8")
    return root


# --------------------------------------------------------------------------- #
#  the demo run
# --------------------------------------------------------------------------- #
def build_sample(*, preset: str | None = None, draft: bool = False,
                 keep: bool = True, clean_video: bool = False, force: bool = False,
                 log=print) -> int:
    from .engine import Project, VideoFactory
    from .render import contact_sheet

    log("\n════════ DEMO RENDER ════════")
    root = write_demo_project(force=True, log=log)
    project = Project.load(root)
    plan = project.plan(preset_override=preset, draft=False)

    factory = VideoFactory(plan, log=log)
    manifest = factory.run(force_scenes=force, burn_subs=True)

    master = Path(manifest["master"])
    log("\n  building QA artefacts…")
    sheet = contact_sheet(master, factory.out_dir / "qa-contact-sheet.png", cols=4, rows=3)
    manifest["qa_contact_sheet"] = str(sheet)
    log(f"  contact sheet -> {sheet}")

    # frame captures prove the file decodes at several points, incl. a caption
    from .probe import frame_grab

    grabs = []
    for t in (2.0, plan.scenes[0].timing["duration"] + 1.5, plan.total_duration * 0.5,
              max(0.5, plan.total_duration - 6.0)):
        p = frame_grab(master, min(t, plan.total_duration - 0.5),
                       factory.out_dir / f"qa-frame-{t:.0f}s.png")
        grabs.append(str(p))
    manifest["qa_frames"] = grabs
    for g in grabs:
        log(f"  frame -> {g}")

    log("\n════════ RESULT ════════")
    for key in ("master", "thumbnail", "poster", "subtitles"):
        val = manifest.get(key)
        if isinstance(val, dict):
            for k, v in val.items():
                log(f"  {k:<10} {v}")
        elif val:
            log(f"  {key:<10} {val}")
    log(f"  duration   {manifest['duration']/60:.2f} min "
        f"({manifest['duration']:.1f}s)")
    log(f"  verified   {'PASS' if manifest['verification']['passed'] else 'FAIL'}")
    for c in manifest["verification"]["checks"]:
        log(f"    {'✔' if c['ok'] else '✘'} {c['check']}: {c['detail']}")

    if clean_video:
        shutil.rmtree(factory.scene_dir, ignore_errors=True)
        log("  cleaned scene intermediates")
    return 0 if manifest["verification"]["passed"] else 2
