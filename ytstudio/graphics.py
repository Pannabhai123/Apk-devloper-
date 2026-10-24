"""Pillow / NumPy graphics: backgrounds, title cards, lower thirds, thumbnails,
end screens and thumbnails.

Everything is generated at render resolution with supersampling where it
matters, so no external image assets (or ImageMagick) are required.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .tools import find_font

# --------------------------------------------------------------------------- #
#  Palette - a calm, modern "documentary" look that reads well on YouTube
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Palette:
    bg_top: tuple = (10, 14, 26)
    bg_bottom: tuple = (22, 40, 72)
    accent: tuple = (255, 176, 59)
    accent2: tuple = (86, 204, 242)
    text: tuple = (245, 247, 252)
    muted: tuple = (166, 178, 200)
    panel: tuple = (16, 22, 38)

    def with_accent(self, accent):
        return Palette(**{**self.__dict__, "accent": tuple(accent)})


DEFAULT_PALETTE = Palette()


# --------------------------------------------------------------------------- #
#  helpers
# --------------------------------------------------------------------------- #
def rgb(pixel) -> tuple:
    return tuple(int(c) for c in pixel[:4]) if len(pixel) >= 4 else tuple(int(c) for c in pixel[:3])


def gradient(size: tuple[int, int], top=(10, 14, 26), bottom=(22, 40, 72),
             angle: float = 90.0, noise: float = 6.0) -> Image.Image:
    """Smooth linear gradient with a whisper of film grain (kills banding)."""
    w, h = size
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    rad = math.radians(angle)
    t = xs * math.cos(rad) + ys * math.sin(rad)
    lo, hi = float(t.min()), float(t.max())
    t = (t - lo) / max(hi - lo, 1e-6)
    t = t[..., None]
    a = np.array(top, dtype=np.float32)
    b = np.array(bottom, dtype=np.float32)
    img = a + (b - a) * t
    if noise:
        rng = np.random.default_rng(7)
        img = img + rng.normal(0, noise, (h, w, 1)).astype(np.float32)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGB")


def radial_glow(size, center=(0.5, 0.35), color=(86, 204, 242), strength=0.55,
                radius=0.6) -> Image.Image:
    """Additive soft light bloom - gives flat backgrounds depth."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = center[0] * w, center[1] * h
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (radius * max(w, h))
    falloff = np.clip(1 - d, 0, 1) ** 2
    alpha = (falloff * strength * 255).astype(np.uint8)
    layer = Image.new("RGBA", size, rgb(color) + (0,))
    layer.putalpha(Image.fromarray(alpha).convert("L"))
    return layer


def vignette(img: Image.Image, strength: float = 0.35) -> Image.Image:
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    mask = np.clip(1 - strength * np.clip((d - 0.55) / 0.75, 0, 1), 0, 1)[..., None]
    arr = np.asarray(img.convert("RGB"), dtype=np.float32) * mask
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGB")


def fit_cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Scale + center-crop to exactly fill `size` (no letterboxing)."""
    tw, th = size
    w, h = img.size
    scale = max(tw / w, th / h)
    nw, nh = max(tw, int(round(w * scale))), max(th, int(round(h * scale)))
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def _font(family: str | None, px: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(find_font(family, weight=weight)), px)


def wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def draw_text_block(draw, text: str, font, fill, *, box: tuple[int, int, int, int],
                    align: str = "left", line_spacing: float = 1.18,
                    stroke: int = 0, stroke_fill=None, shadow: int = 0) -> int:
    """Draw wrapped text inside box=(x, y, max_width, max_height); returns height used."""
    x, y, max_w, max_h = box
    lines = wrap(draw, text, font, max_w)
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * line_spacing)
    for i, line in enumerate(lines):
        if y + (i + 1) * line_h > y + max_h and i > 0:
            break
        lw = draw.textlength(line, font=font)
        if align == "center":
            lx = x + (max_w - lw) / 2
        elif align == "right":
            lx = x + max_w - lw
        else:
            lx = x
        if shadow:
            draw.text((lx + shadow, y + i * line_h + shadow), line, font=font,
                      fill=(0, 0, 0, 140))
        draw.text((lx, y + i * line_h), line, font=font, fill=fill,
                  stroke_width=stroke, stroke_fill=stroke_fill)
    return len(lines) * line_h


def rounded_panel(size, radius=28, fill=(16, 22, 38, 205), border=None, border_width=2):
    w, h = size
    panel = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=fill,
                        outline=border, width=border_width if border else 0)
    return panel


# --------------------------------------------------------------------------- #
#  Backgrounds
# --------------------------------------------------------------------------- #
def background(size=(1920, 1080), palette: Palette | tuple = DEFAULT_PALETTE,
               style: str = "gradient") -> Image.Image:
    """Full-frame background. `palette` may also be a (top, bottom) RGB tuple."""
    if isinstance(palette, (tuple, list)):
        # (top, bottom) pair of RGB(A) tuples - a common shorthand in notebooks
        def _rgb(c):
            c = (c,) * 3 if isinstance(c, (int, float)) else tuple(c)
            return tuple(int(v) for v in c[:3])

        palette = Palette(bg_top=_rgb(palette[0]), bg_bottom=_rgb(palette[-1]))
    base = gradient(size, palette.bg_top, palette.bg_bottom, angle=105).convert("RGBA")
    if style == "grid":  # subtle technical grid
        d = ImageDraw.Draw(base)
        step = max(size) // 24
        for x in range(0, size[0], step):
            d.line([(x, 0), (x, size[1])], fill=(255, 255, 255, 8), width=1)
        for y in range(0, size[1], step):
            d.line([(0, y), (size[0], y)], fill=(255, 255, 255, 8), width=1)
    base.alpha_composite(radial_glow(size, (0.22, 0.18), palette.accent2, 0.30, 0.75))
    base.alpha_composite(radial_glow(size, (0.85, 0.85), palette.accent, 0.22, 0.6))
    return vignette(base.convert("RGB"), 0.5).convert("RGBA")


def bokeh_particles(size=(1920, 1080), count=40, seed=3, palette=DEFAULT_PALETTE) -> Image.Image:
    """Transparent layer of soft out-of-focus dots - used behind titles."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    rng = random.Random(seed)
    for _ in range(count):
        r = rng.randint(4, 26)
        x = rng.randint(0, size[0])
        y = rng.randint(0, size[1])
        col = palette.accent if rng.random() < 0.4 else palette.accent2
        alpha = rng.randint(18, 70)
        dot = Image.new("RGBA", (r * 6, r * 6), (0, 0, 0, 0))
        ImageDraw.Draw(dot).ellipse([r * 2, r * 2, r * 4, r * 4], fill=rgb(col) + (alpha,))
        layer.alpha_composite(dot.filter(ImageFilter.GaussianBlur(r * 0.8)), (x - r * 3, y - r * 3))
    return layer


# --------------------------------------------------------------------------- #
#  Cards & overlays
# --------------------------------------------------------------------------- #
def title_text_png(text: str, size=(1920, 1080), *, font_px=104, family=None,
                   color=(245, 247, 252), accent=(255, 176, 59),
                   box=None, align="center", underline=True,
                   shadow=6, letter_emphasis: str | None = None) -> Image.Image:
    """Transparent PNG containing the (possibly multi-line) title, vertically centred."""
    if box is None:  # safe-margin text box that scales with the canvas
        box = (int(size[0] * 0.08), 0, int(size[0] * 0.84), size[1])
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = _font(family, font_px, "bold")
    lines = wrap(d, text, font, box[2])
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * 1.14)
    block_h = line_h * len(lines)
    y0 = (size[1] - block_h) // 2 + box[1]
    for i, line in enumerate(lines):
        lw = d.textlength(line, font=font)
        x = box[0] + (box[2] - lw) / 2 if align == "center" else box[0]
        y = y0 + i * line_h
        if shadow:
            d.text((x + shadow, y + shadow), line, font=font, fill=(0, 0, 0, 160))
        d.text((x, y), line, font=font, fill=rgb(color) + (255,))
    if underline:
        bar_w = int(min(box[2], max(220, font_px * 2.4)))
        bx = box[0] + (box[2] - bar_w) / 2 if align == "center" else box[0]
        by = y0 + block_h + int(font_px * 0.28)
        d.rounded_rectangle([bx, by, bx + bar_w, by + max(6, font_px // 12)], radius=6,
                            fill=rgb(accent) + (240,))
    return layer


def subtitle_strip_png(text: str, size=(1920, 1080), *, font_px=54, family=None,
                       color=(255, 255, 255), accent=(255, 176, 59),
                       y_frac: float = 0.76) -> Image.Image:
    """A lower-third caption bar; used by the animated-caption scene type."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = _font(family, font_px, "bold")
    max_w = int(size[0] * 0.72)
    lines = wrap(d, text, font, max_w)
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * 1.2)
    tw = max(d.textlength(l, font=font) for l in lines)
    pad_x, pad_y = 44, 26
    bw = int(tw + pad_x * 2)
    bh = int(line_h * len(lines) + pad_y * 2)
    x0 = (size[0] - bw) // 2
    y0 = int(size[1] * y_frac)
    panel = rounded_panel((bw, bh), radius=22, fill=(8, 11, 20, 200),
                          border=rgb(accent) + (200,), border_width=3)
    layer.alpha_composite(panel, (x0, y0))
    for i, line in enumerate(lines):
        lw = d.textlength(line, font=font)
        d.text((x0 + (bw - lw) / 2, y0 + pad_y + i * line_h), line, font=font,
               fill=rgb(color) + (255,))
    return layer


def lower_third_png(name: str, role: str = "", size=(1920, 1080), *,
                    family=None, palette: Palette = DEFAULT_PALETTE) -> Image.Image:
    """Broadcast-style lower third with an accent bar."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    name_font = _font(family, 58, "bold")
    role_font = _font(family, 34, "regular")
    nw = d.textlength(name, font=name_font)
    rw = d.textlength(role, font=role_font) if role else 0
    bw = int(max(nw, rw) + 130)
    bh = 150 if role else 104
    x0, y0 = 120, int(size[1] * 0.70)
    layer.alpha_composite(rounded_panel((bw, bh), radius=18, fill=(10, 14, 26, 214),
                                       border=rgb(palette.accent) + (230,), border_width=3), (x0, y0))
    d.rectangle([x0, y0, x0 + 12, y0 + bh], fill=rgb(palette.accent) + (255,))
    d.text((x0 + 48, y0 + 26), name, font=name_font, fill=rgb(palette.text) + (255,))
    if role:
        d.text((x0 + 48, y0 + 96), role.upper(), font=role_font, fill=rgb(palette.accent2) + (255,))
    return layer


def bullets_png(headline: str, bullets: list[str], size=(1920, 1080), *,
                family=None, palette: Palette = DEFAULT_PALETTE, font_px=48,
                reveal_first: int = 1) -> list[Image.Image]:
    """Return one transparent PNG per reveal step (headline + N bullets visible).

    Rendering each step as a still and cross-fading in FFmpeg gives a crisp,
    GPU-free 'build up the list' animation.
    """
    frames: list[Image.Image] = []
    head_px = int(font_px * 1.55)
    for step in range(reveal_first, len(bullets) + 1):
        layer = Image.new("RGBA", size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        head_font = _font(family, head_px, "bold")
        body_font = _font(family, font_px, "regular")
        x0, y0 = 140, int(size[1] * 0.16)
        max_w = int(size[0] * 0.78)
        used = draw_text_block(d, headline, head_font, rgb(palette.text) + (255,),
                               box=(x0, y0, max_w, 260), line_spacing=1.12, shadow=4)
        # accent rule under the headline
        rule_y = y0 + used + 24
        d.rounded_rectangle([x0, rule_y, x0 + 150, rule_y + 8], radius=4,
                            fill=rgb(palette.accent) + (255,))
        cy = rule_y + 60
        for i, item in enumerate(bullets[:step]):
            d.ellipse([x0 + 6, cy + font_px * 0.30, x0 + 6 + 22, cy + font_px * 0.30 + 22],
                      fill=rgb(palette.accent2) + (255,))
            h = draw_text_block(d, item, body_font, rgb(palette.text) + (250,),
                                box=(x0 + 62, cy, max_w - 62, 200), line_spacing=1.15)
            cy += h + int(font_px * 1.05)
        frames.append(layer)
    return frames


def end_screen_png(size=(1920, 1080), *, channel: str = "Your Channel",
                   next_video: str = "Next video", subscribe: str = "SUBSCRIBE",
                   family=None, palette: Palette = DEFAULT_PALETTE) -> Image.Image:
    """YouTube end screen: 2 clickable zones + subscribe prompt (safe margins)."""
    base = background(size, palette, style="grid")
    d = ImageDraw.Draw(base)
    w, h = size
    # safe area is inset 5% so nothing hides behind YouTube UI
    zone_w, zone_h = int(w * 0.34), int(h * 0.30)
    left_zone = (int(w * 0.10), int(h * 0.34), int(w * 0.10) + zone_w, int(h * 0.34) + zone_h)
    right_zone = (int(w * 0.56), int(h * 0.34), int(w * 0.56) + zone_w, int(h * 0.34) + zone_h)
    for z in (left_zone, right_zone):
        base.alpha_composite(rounded_panel((z[2] - z[0], z[3] - z[1]), radius=26,
                                           fill=(255, 255, 255, 12),
                                           border=(255, 255, 255, 60), border_width=2), (z[0], z[1]))
    play_font = _font(family, 92, "bold")
    small = _font(family, 40, "regular")
    title_font = _font(family, 96, "bold")
    sub_font = _font(family, 44, "regular")

    # left zone: subscribe
    cx = (left_zone[0] + left_zone[2]) // 2
    tri = int(zone_h * 0.20)
    cy = left_zone[1] + int(zone_h * 0.36)
    d.polygon([(cx - tri * 0.55, cy - tri), (cx - tri * 0.55, cy + tri),
               (cx + tri * 0.85, cy)], fill=rgb(palette.accent) + (255,))
    d.text((cx, left_zone[1] + zone_h - 78), subscribe, font=small, anchor="mm",
           fill=rgb(palette.text))
    # right zone: next video thumbnail placeholder
    d.text((right_zone[0] + zone_w // 2, right_zone[1] + zone_h // 2 - 10), "NEXT VIDEO",
           font=small, anchor="mm", fill=rgb(palette.muted))
    # bottom: channel line
    d.text((w // 2, int(h * 0.80)), channel, font=title_font, anchor="mm",
           fill=rgb(palette.text))
    d.text((w // 2, int(h * 0.88)), next_video, font=sub_font, anchor="mm",
           fill=rgb(palette.accent2))
    return base.convert("RGBA")


def thumbnail(size=(1280, 720), *, title: str, subtitle: str = "", badge: str = "",
              image: str | Path | None = None, family=None,
              palette: Palette = DEFAULT_PALETTE) -> Image.Image:
    """High-CTR YouTube thumbnail: big bold type, strong contrast, face-safe."""
    w, h = size
    if image:
        base = fit_cover(Image.open(image).convert("RGB"), size).convert("RGBA")
        # darken the left/bottom for legibility
        shade = gradient(size, (0, 0, 0), (0, 0, 0), angle=90).convert("RGBA")
        alpha = Image.new("L", size, 0)
        ImageDraw.Draw(alpha).rectangle([0, int(h * 0.42), w, h], fill=215)
        shade.putalpha(alpha)
        base.alpha_composite(shade)
    else:
        base = background(size, palette, style="grid")
    d = ImageDraw.Draw(base)
    pad = int(w * 0.06)
    font = _font(family, int(h * 0.13), "bold")
    lines = wrap(d, title.upper(), font, int(w * 0.86))
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * 1.02)
    total = line_h * len(lines)
    y = h - pad - total - (int(h * 0.10) if subtitle else 0)
    for i, line in enumerate(lines):
        d.text((pad + 6, y + i * line_h + 6), line, font=font, fill=(0, 0, 0, 200))
        d.text((pad, y + i * line_h), line, font=font, fill=rgb(palette.text) + (255,),
               stroke_width=max(2, int(h * 0.008)), stroke_fill=(0, 0, 0, 255))
    if subtitle:
        sf = _font(family, int(h * 0.062), "regular")
        d.text((pad, y + total + int(h * 0.02)), subtitle, font=sf, fill=rgb(palette.accent) + (255,))
    if badge:
        bf = _font(family, int(h * 0.055), "bold")
        bw = d.textlength(badge.upper(), font=bf) + 48
        bh = int(h * 0.105)
        base.alpha_composite(rounded_panel((int(bw), bh), radius=12,
                                          fill=rgb(palette.accent) + (255,)), (pad, pad))
        d.text((pad + 24, pad + bh * 0.26), badge.upper(), font=bf, fill=(12, 14, 20, 255))
    # accent bar
    d.rectangle([0, h - 10, w, h], fill=rgb(palette.accent) + (255,))
    return base.convert("RGB")


def chapter_card(number: str, title: str, size=(1920, 1080), *, family=None,
                 palette: Palette = DEFAULT_PALETTE) -> Image.Image:
    """Full-frame chapter/segment card."""
    base = background(size, palette, style="grid")
    d = ImageDraw.Draw(base)
    w, h = size
    num_font = _font(family, int(h * 0.24), "bold")
    rule_x = int(w * 0.19)
    d.text((rule_x - int(w * 0.025), int(h * 0.5)), number, font=num_font, anchor="rm",
           fill=rgb(palette.accent) + (60,))
    d.line([(rule_x, int(h * 0.34)), (rule_x, int(h * 0.66))],
           fill=rgb(palette.accent) + (255,), width=8)
    title_font = _font(family, int(h * 0.085), "bold")
    draw_text_block(d, title, title_font, rgb(palette.text) + (255,),
                    box=(int(w * 0.19), int(h * 0.42), int(w * 0.66), int(h * 0.3)),
                    line_spacing=1.12, shadow=5)
    return base.convert("RGBA")


def watermark_png(text: str, size=(1920, 1080), *, family=None,
                  palette: Palette = DEFAULT_PALETTE) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = _font(family, 30, "bold")
    tw = d.textlength(text, font=f)
    d.text((size[0] - tw - 56, 48), text, font=f, fill=rgb(palette.text) + (110,))
    return layer


def save_png(img: Image.Image, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    return path
