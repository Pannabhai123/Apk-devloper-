"""Scene types and their renderers.

A *scene* is one self-contained video segment (video only - audio is assembled
separately so narration stays sample-accurate). Supported kinds:

  title · chapter · bullets · image · slideshow · video · quote · stats
  endscreen · outro · blank

Every renderer emits a clip that already matches the delivery resolution and
frame rate, so the final join is a straight cross-fade.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path

from PIL import Image

from . import graphics
from .presets import VideoPreset, intermediate_for
from .probe import probe
from .render import (animated_overlay, compose_still_clip, concat_segments,
                     kenburns_filter, loop_clip_to_duration, normalize_clip,
                     overlay_sequence, slideshow, still_to_clip)
from .tools import PROJECTS_DIR

KINDS = {"title", "chapter", "bullets", "image", "slideshow", "video", "quote",
         "stats", "endscreen", "outro", "blank"}

MOTIONS = {"zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "none"}


@dataclass
class Scene:
    kind: str = "title"
    # --- text content ---
    title: str = ""
    subtitle: str = ""
    headline: str = ""
    body: str = ""
    bullets: list[str] = field(default_factory=list)
    number: str = ""
    attribution: str = ""
    speaker: str = ""
    # --- media ---
    image: str | None = None
    images: list[str] = field(default_factory=list)
    video: str | None = None
    # --- timing & style ---
    duration: float | None = None
    motion: str = "zoom_in"
    background: str = "gradient"
    accent: str | None = None
    layout: str = "center"
    transition: str = "fade"
    transition_duration: float = 0.6
    # --- narration (script text + optional pre-rendered voice file) ---
    narration: str = ""
    voice: str | None = None
    captions: bool = True
    # --- internal ---
    index: int = 0
    timing: dict = field(default_factory=dict)

    def __post_init__(self):
        if self.kind not in KINDS:
            raise ValueError(f"unknown scene kind {self.kind!r}; use one of {sorted(KINDS)}")
        if self.motion not in MOTIONS:
            self.motion = "zoom_in"

    # ------------------------------------------------------------------ #
    def resolved_duration(self, default: float = 6.0) -> float:
        """Duration precedence: explicit > narration audio > estimate > default."""
        if self.kind == "endscreen":
            # YouTube needs end-screen elements present for >= 5-10 s
            base = float(self.duration) if self.duration else default
            return max(base, 10.0)
        if self.duration:
            return float(self.duration)
        if self.voice and Path(self.voice).exists():
            return probe(self.voice).duration + 0.9
        if self.narration:
            from .audio import estimate_speech_seconds

            return max(3.0, estimate_speech_seconds(self.narration) + 1.0)
        return default

    def palette(self):
        pal = graphics.DEFAULT_PALETTE
        if self.accent:
            pal = pal.with_accent(_hex_to_rgb(self.accent))
        return pal

    def fingerprint(self, preset: VideoPreset) -> str:
        payload = asdict(self)
        for k in ("timing",):
            payload.pop(k, None)
        blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        blob += f"|{preset.width}x{preset.height}@{preset.fps}|v2"
        return hashlib.sha256(blob.encode()).hexdigest()[:16]


def _hex_to_rgb(value: str) -> tuple:
    v = value.strip().lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


# --------------------------------------------------------------------------- #
#  the renderer
# --------------------------------------------------------------------------- #
class SceneRenderer:
    def __init__(self, preset: VideoPreset, workdir: str | Path):
        self.preset = preset
        self.inter = intermediate_for(preset)
        self.workdir = Path(workdir)
        self.workdir.mkdir(parents=True, exist_ok=True)

    # -- helpers -------------------------------------------------------- #
    def _bg_png(self, scene: Scene, name: str) -> Path:
        pal = scene.palette()
        bg = graphics.background((self.preset.width, self.preset.height), pal,
                                 style=scene.background)
        bg.alpha_composite(graphics.bokeh_particles((self.preset.width, self.preset.height),
                                                     palette=pal, seed=scene.index + 3))
        return graphics.save_png(bg, self.workdir / f"{scene.index:02d}_{name}_bg.png")

    def _base_from_still(self, still: Path, scene: Scene, dur: float, name: str) -> Path:
        return still_to_clip(still, self.workdir / f"{scene.index:02d}_{name}_base.mp4",
                             dur=dur, preset=self.inter, motion=scene.motion,
                             strength=1.12)

    # -- public --------------------------------------------------------- #
    def render(self, scene: Scene, dur: float | None = None) -> Path:
        dur = dur or scene.resolved_duration()
        out = self.workdir / f"scene_{scene.index:02d}.mp4"
        kind = scene.kind
        handler = getattr(self, f"_r_{kind}", None)
        if handler is None:  # 'blank'
            handler = self._r_blank
        final = handler(scene, dur, out)
        # keep the timeline start computed by the planner - only annotate the file
        scene.timing = {**scene.timing, "start": scene.timing.get("start", 0.0),
                        "duration": dur, "file": str(final)}
        return final

    # -- individual scene kinds ----------------------------------------- #
    def _r_blank(self, scene: Scene, dur: float, out: Path) -> Path:
        bg = self._bg_png(scene, "blank")
        return still_to_clip(bg, out, dur=dur, preset=self.inter, motion=scene.motion)

    def _r_title(self, scene: Scene, dur: float, out: Path) -> Path:
        pal = scene.palette()
        bg = self._bg_png(scene, "title")
        overlay = graphics.title_text_png(
            scene.title or scene.headline or "Title",
            (self.preset.width, self.preset.height),
            font_px=int(self.preset.height * 0.095),
            color=pal.text, accent=pal.accent,
            box=(int(self.preset.width * 0.08), 0, int(self.preset.width * 0.84),
                 self.preset.height),
        )
        if scene.subtitle:
            from PIL import ImageDraw

            d = ImageDraw.Draw(overlay)
            f = _sub_font(int(self.preset.height * 0.032))
            tw = d.textlength(scene.subtitle, font=f)
            d.text(((self.preset.width - tw) / 2, self.preset.height * 0.70),
                   scene.subtitle, font=f, fill=pal.muted + (235,))
        png = graphics.save_png(overlay, self.workdir / f"{scene.index:02d}_title_overlay.png")
        return compose_still_clip(bg, out, preset=self.inter, dur=dur,
                                  motion=scene.motion, strength=1.12,
                                  overlays=[(png, 0.35, dur - 0.4, "up", 60)],
                                  fade_in=0.35, fade_out=0.45)

    def _r_chapter(self, scene: Scene, dur: float, out: Path) -> Path:
        card = graphics.chapter_card(scene.number or f"{scene.index:02d}",
                                     scene.title or scene.headline,
                                     (self.preset.width, self.preset.height),
                                     palette=scene.palette())
        png = graphics.save_png(card, self.workdir / f"{scene.index:02d}_chapter.png")
        if scene.subtitle:
            ov = graphics.title_text_png(
                scene.subtitle, (self.preset.width, self.preset.height),
                font_px=int(self.preset.height * 0.028),
                color=scene.palette().muted, accent=scene.palette().accent,
                box=(int(self.preset.width * 0.19), int(self.preset.height * 0.60),
                     int(self.preset.width * 0.66), int(self.preset.height * 0.25)),
                align="left", underline=False, shadow=2)
            ovp = graphics.save_png(ov, self.workdir / f"{scene.index:02d}_chapter_sub.png")
            return compose_still_clip(png, out, preset=self.inter, dur=dur,
                                      motion="zoom_out", strength=1.06,
                                      overlays=[(ovp, 0.5, dur - 0.35, "up", 30)])
        return still_to_clip(png, out, dur=dur, preset=self.inter, motion="zoom_out",
                             strength=1.06)

    def _r_bullets(self, scene: Scene, dur: float, out: Path) -> Path:
        pal = scene.palette()
        bg = self._bg_png(scene, "bullets")
        steps = graphics.bullets_png(scene.headline or scene.title, scene.bullets or [scene.body],
                                     (self.preset.width, self.preset.height),
                                     palette=pal, font_px=int(self.preset.height * 0.044))
        pngs = [graphics.save_png(s, self.workdir / f"{scene.index:02d}_b{i}.png")
                for i, s in enumerate(steps)]
        n = len(pngs)
        intro = min(1.2, dur * 0.2)
        step = (dur - intro) / max(1, n)
        windows = [(p, intro + i * step, dur - 0.05, "up", 45) for i, p in enumerate(pngs)]
        return compose_still_clip(bg, out, preset=self.inter, dur=dur,
                                  motion="none", overlays=windows)

    def _r_stats(self, scene: Scene, dur: float, out: Path) -> Path:
        """A big-number scene (e.g. '87%' + explanation)."""
        pal = scene.palette()
        bg = self._bg_png(scene, "stats")
        from PIL import ImageDraw

        layer = Image.new("RGBA", (self.preset.width, self.preset.height), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        big = _sub_font(int(self.preset.height * 0.26), weight="bold")
        d.text((self.preset.width * 0.5, self.preset.height * 0.44),
               scene.title or scene.headline, font=big, anchor="mm",
               fill=pal.accent + (255,))
        cap = _sub_font(int(self.preset.height * 0.040))
        d.text((self.preset.width * 0.5, self.preset.height * 0.66),
               scene.subtitle or scene.body, font=cap, anchor="mm",
               fill=pal.text + (245,))
        png = graphics.save_png(layer, self.workdir / f"{scene.index:02d}_stats.png")
        return compose_still_clip(bg, out, preset=self.inter, dur=dur,
                                  motion=scene.motion,
                                  overlays=[(png, 0.3, dur - 0.35, "up", 40)])

    def _r_image(self, scene: Scene, dur: float, out: Path) -> Path:
        if not scene.image or not Path(scene.image).exists():
            raise FileNotFoundError(
                f"scene {scene.index}: image not found: {scene.image!r}")
        img = Image.open(scene.image).convert("RGB")
        cover = graphics.fit_cover(img, (self.preset.width, self.preset.height))
        still = graphics.save_png(graphics.vignette(cover, 0.35),
                                  self.workdir / f"{scene.index:02d}_img.png")
        text = scene.title or scene.headline or scene.body
        if not text:
            return still_to_clip(still, out, dur=dur, preset=self.inter,
                                 motion=scene.motion, strength=1.06)
        pal = scene.palette()
        if scene.layout == "lower":
            ov = graphics.subtitle_strip_png(text, (self.preset.width, self.preset.height),
                                             font_px=int(self.preset.height * 0.034),
                                             accent=pal.accent, y_frac=0.70)
        else:
            ov = graphics.title_text_png(
                text, (self.preset.width, self.preset.height),
                font_px=int(self.preset.height * 0.062), color=pal.text,
                accent=pal.accent,
                box=(int(self.preset.width * 0.10), int(self.preset.height * 0.55),
                     int(self.preset.width * 0.80), int(self.preset.height * 0.38)))
        png = graphics.save_png(ov, self.workdir / f"{scene.index:02d}_img_ov.png")
        return compose_still_clip(still, out, preset=self.inter, dur=dur,
                                  motion=scene.motion, strength=1.06,
                                  overlays=[(png, 0.4, dur - 0.35, "up", 50)])

    def _r_slideshow(self, scene: Scene, dur: float, out: Path) -> Path:
        imgs = scene.images or ([scene.image] if scene.image else [])
        imgs = [p for p in imgs if p and Path(p).exists()]
        if not imgs:
            raise FileNotFoundError(f"scene {scene.index}: slideshow needs images")
        per = dur / len(imgs)
        prepared = []
        for i, p in enumerate(imgs):
            im = graphics.fit_cover(Image.open(p).convert("RGB"),
                                    (self.preset.width, self.preset.height))
            prepared.append(graphics.save_png(
                graphics.vignette(im, 0.3),
                self.workdir / f"{scene.index:02d}_slide{i}.png"))
        return slideshow(prepared, out, dur_per_image=per, preset=self.inter)

    def _r_video(self, scene: Scene, dur: float, out: Path) -> Path:
        if not scene.video or not Path(scene.video).exists():
            raise FileNotFoundError(f"scene {scene.index}: clip not found: {scene.video!r}")
        info = probe(scene.video)
        if info.duration + 0.05 < dur:
            base = loop_clip_to_duration(scene.video,
                                         self.workdir / f"{scene.index:02d}_clip.mp4",
                                         preset=self.inter, dur=dur)
        else:
            base = normalize_clip(scene.video, self.workdir / f"{scene.index:02d}_clip.mp4",
                                  preset=self.inter, dur=dur, mode="cover")
        text = scene.title or scene.headline
        if not text:
            return normalize_clip(scene.video, out, preset=self.inter, dur=dur, mode="cover")
        pal = scene.palette()
        ov = (graphics.lower_third_png(scene.title, scene.subtitle, 
                                       (self.preset.width, self.preset.height), palette=pal)
              if scene.layout == "lower"
              else graphics.subtitle_strip_png(text, (self.preset.width, self.preset.height),
                                               font_px=int(self.preset.height * 0.036),
                                               accent=pal.accent))
        png = graphics.save_png(ov, self.workdir / f"{scene.index:02d}_clip_ov.png")
        return animated_overlay(base, png, out, preset=self.inter, dur=dur,
                                fade_in=0.5, fade_out=0.4, slide="left", slide_px=70,
                                delay=0.5)

    def _r_quote(self, scene: Scene, dur: float, out: Path) -> Path:
        pal = scene.palette()
        bg = self._bg_png(scene, "quote")
        from PIL import ImageDraw

        layer = Image.new("RGBA", (self.preset.width, self.preset.height), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        qf = _sub_font(int(self.preset.height * 0.30), weight="bold")
        d.text((self.preset.width * 0.10, self.preset.height * 0.14), "\u201c",
               font=qf, anchor="lm", fill=pal.accent + (60,))
        body = _sub_font(int(self.preset.height * 0.052))
        h = graphics.draw_text_block(
            d, scene.title or scene.body, body, pal.text + (255,),
            box=(int(self.preset.width * 0.16), int(self.preset.height * 0.36),
                 int(self.preset.width * 0.68), int(self.preset.height * 0.36)),
            align="center", line_spacing=1.25, shadow=3)
        if scene.attribution:
            af = _sub_font(int(self.preset.height * 0.030))
            tw = d.textlength(f"— {scene.attribution}", font=af)
            d.text(((self.preset.width - tw) / 2,
                    self.preset.height * 0.36 + h + self.preset.height * 0.05),
                   f"— {scene.attribution}", font=af, fill=pal.accent2 + (240,))
        png = graphics.save_png(layer, self.workdir / f"{scene.index:02d}_quote.png")
        return compose_still_clip(bg, out, preset=self.inter, dur=dur,
                                  motion=scene.motion,
                                  overlays=[(png, 0.4, dur - 0.5, "up", 30)],
                                  fade_in=0.4, fade_out=0.5)

    def _r_endscreen(self, scene: Scene, dur: float, out: Path) -> Path:
        from .graphics import end_screen_png

        card = end_screen_png((self.preset.width, self.preset.height),
                              channel=scene.title or "Your Channel",
                              next_video=scene.subtitle or "Next video",
                              palette=scene.palette())
        png = graphics.save_png(card, self.workdir / f"{scene.index:02d}_endscreen.png")
        # leave >= 10 s on screen at the end: that is a hard YouTube requirement
        return compose_still_clip(png, out, preset=self.inter, dur=max(dur, 10.0),
                                  motion="zoom_in", strength=1.05,
                                  fade_in=0.6, fade_out=0.6)

    def _r_outro(self, scene: Scene, dur: float, out: Path) -> Path:
        pal = scene.palette()
        bg = self._bg_png(scene, "outro")
        layer = Image.new("RGBA", (self.preset.width, self.preset.height), (0, 0, 0, 0))
        from PIL import ImageDraw

        d = ImageDraw.Draw(layer)
        f1 = _sub_font(int(self.preset.height * 0.075), weight="bold")
        f2 = _sub_font(int(self.preset.height * 0.034))
        d.text((self.preset.width / 2, self.preset.height * 0.44),
               scene.title or "Thanks for watching", font=f1, anchor="mm",
               fill=pal.text + (255,))
        d.text((self.preset.width / 2, self.preset.height * 0.55),
               scene.subtitle or "Subscribe for the next one", font=f2, anchor="mm",
               fill=pal.accent + (255,))
        png = graphics.save_png(layer, self.workdir / f"{scene.index:02d}_outro.png")
        return compose_still_clip(bg, out, preset=self.inter, dur=dur,
                                  motion=scene.motion,
                                  overlays=[(png, 0.3, dur - 0.6, "up", 40)],
                                  fade_in=0.4, fade_out=0.7)


# --------------------------------------------------------------------------- #
def _sub_font(px: int, weight: str = "regular"):
    from PIL import ImageFont

    from .tools import find_font

    return ImageFont.truetype(str(find_font(None, weight=weight)), px)
