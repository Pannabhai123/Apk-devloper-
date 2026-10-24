"""Project engine: turn a folder of assets + a YAML script into a finished
long-form YouTube video.

Pipeline
--------
    plan()    -> resolve assets, compute scene durations & narration timeline
    render()  -> per-scene clips (resumable) -> cross-faded join (+ burned subs)
                 -> narration stem -> ducked music mix -> loudness normalise
                 -> final mux -> subtitle sidecars -> thumbnail -> verify

Every stage writes a file under ``build/`` so a crash only costs the stage that
was running.
"""

from __future__ import annotations

import json
import os
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from . import audio as audio_mod
from . import graphics, subtitles
from .presets import DEFAULT_PRESET, VideoPreset, get_preset, hardware_variant, intermediate_for
from .probe import frame_grab, probe, verify
from .render import (build_narration_track, concat_segments, mux_audio,
                     replace_audio_video, still_to_clip, write_manifest)
from .scenes import Scene, SceneRenderer
from .tools import PROJECTS_DIR, ffmpeg, fontconfig_env, has_filter

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus"}


# --------------------------------------------------------------------------- #
#  data model
# --------------------------------------------------------------------------- #
@dataclass
class Plan:
    project: "Project"
    scenes: list[Scene]
    preset: VideoPreset
    total_duration: float
    transition_type: str = "fade"
    transition_duration: float = 0.6
    narration_entries: list[tuple[str, float]] = field(default_factory=list)
    cues: list = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def chapters(self, *, min_gap: float = 10.0, max_chapters: int = 40) -> str:
        """YouTube description chapter block.

        YouTube needs the first stamp to be 0:00 and every chapter to be at
        least 10 s long, otherwise it silently ignores the list - so that is
        enforced here instead of letting the upload fail.
        """
        rows = []
        for row in self.timeline():
            label = (row["title"] or "").strip()
            if not label or row["kind"] in ("blank", "endscreen"):
                continue
            rows.append((row["start"], label))
        if not rows:
            return ""
        if rows[0][0] > 1.0:  # must start at 0:00
            rows.insert(0, (0.0, "Intro"))
        else:
            rows[0] = (0.0, rows[0][1])
        kept = [rows[0]]
        for start, label in rows[1:]:
            if start - kept[-1][0] >= min_gap:
                kept.append((start, label))
            if len(kept) >= max_chapters:
                break
        lines = []
        for start, label in kept:
            m, sec = divmod(int(round(start)), 60)
            h, m = divmod(m, 60)
            stamp = f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"
            label = label if len(label) <= 78 else label[:75].rsplit(" ", 1)[0] + "…"
            lines.append(f"{stamp} {label}")
        return "\n".join(lines)

    def timeline(self) -> list[dict]:
        return [
            {"index": s.index, "kind": s.kind, "start": round(s.timing.get("start", 0), 2),
             "duration": round(s.timing.get("duration", 0), 2),
             "title": s.title or s.headline or _first_sentence(s.narration)}
            for s in self.scenes
        ]


@dataclass
class Project:
    root: Path
    config: dict
    build_dir: Path
    assets_dir: Path

    # ---- construction -------------------------------------------------- #
    @classmethod
    def load(cls, path: str | Path) -> "Project":
        path = Path(path)
        root = path.parent if path.is_file() else path
        cfg_file = path if path.is_file() else root / "project.yaml"
        if not cfg_file.exists():
            raise FileNotFoundError(f"no project.yaml at {cfg_file}")
        cfg = yaml.safe_load(cfg_file.read_text(encoding="utf-8")) or {}
        build_dir = root / cfg.get("build_dir", "build")
        assets = root / cfg.get("assets_dir", "assets")
        return cls(root=root, config=cfg, build_dir=build_dir, assets_dir=assets)

    # ---- convenience accessors ----------------------------------------- #
    @property
    def meta(self) -> dict:
        return self.config.get("project", {}) or {}

    @property
    def slug(self) -> str:
        return self.meta.get("slug") or _slugify(self.meta.get("title", self.root.name))

    @property
    def accent(self) -> str | None:
        return (self.meta.get("brand") or {}).get("accent")

    def resolve_preset(self, *, override: str | None = None, draft: bool = False) -> VideoPreset:
        name = override or self.meta.get("preset") or DEFAULT_PRESET
        if draft:
            name = "draft-720p30"
        p = get_preset(name)
        res = self.meta.get("resolution")
        if res and isinstance(res, str) and "x" in res and not draft:
            w, h = res.lower().split("x")
            p.width, p.height = int(w), int(h)
        if self.meta.get("fps") and not draft:
            p.fps = int(self.meta["fps"])
        p.name = f"{p.name}-{p.width}x{p.height}@{p.fps}"
        return p

    # ---- asset resolution ---------------------------------------------- #
    def _asset(self, value: str | None, kind: str = "any") -> str | None:
        if not value:
            return None
        p = Path(value)
        if not p.is_absolute():
            p = self.root / p
        if p.exists():
            return str(p)
        # also try the assets folders
        for sub in ("images", "clips", "audio", "music", "voice", "fonts"):
            cand = self.assets_dir / sub / value
            if cand.exists():
                return str(cand)
        return None

    def discover_assets(self, kind: str) -> list[str]:
        ext = {"image": IMAGE_EXT, "video": VIDEO_EXT, "audio": AUDIO_EXT}[kind]
        folder = {"image": "images", "video": "clips", "audio": "audio"}[kind]
        out: list[str] = []
        for d in (self.assets_dir / folder, self.assets_dir):
            if d.is_dir():
                for f in sorted(d.iterdir()):
                    if f.is_file() and f.suffix.lower() in ext:
                        out.append(str(f))
            if out:
                break
        return out

    # ---- planning ------------------------------------------------------- #
    def plan(self, *, preset_override: str | None = None, draft: bool = False,
             strict: bool = True) -> Plan:
        preset = self.resolve_preset(override=preset_override, draft=draft)
        raw_scenes = self.config.get("scenes") or []
        if not raw_scenes:
            raise ValueError("project has no scenes - add them under `scenes:` in project.yaml")

        images = self.discover_assets("image")
        clips = self.discover_assets("video")
        img_i = clip_i = 0
        scenes: list[Scene] = []
        warnings: list[str] = []

        for i, raw in enumerate(raw_scenes):
            raw = dict(raw or {})
            raw.setdefault("kind", "title")
            raw["index"] = i
            if raw.get("accent") is None and self.accent:
                raw["accent"] = self.accent
            # resolve media
            raw["image"] = self._asset(raw.get("image"), "image")
            raw["video"] = self._asset(raw.get("video"), "video")
            raw["images"] = [self._asset(x, "image") for x in (raw.get("images") or [])]
            raw["images"] = [x for x in raw["images"] if x]
            raw["voice"] = self._asset(raw.get("voice"), "audio")

            # auto-assign unused B-roll so a folder drop just works
            if raw["kind"] == "image" and not raw["image"] and img_i < len(images):
                raw["image"] = images[img_i]
                img_i += 1
            if raw["kind"] == "video" and not raw["video"] and clip_i < len(clips):
                raw["video"] = clips[clip_i]
                clip_i += 1
            if raw["kind"] == "slideshow" and not raw["images"]:
                remaining = images[img_i:img_i + int(raw.get("image_count", 4))]
                raw["images"] = remaining
                img_i += len(remaining)

            known = set(Scene.__dataclass_fields__)
            unknown = set(raw) - known
            if unknown:
                warnings.append(f"scene {i}: unknown keys ignored {sorted(unknown)}")
            scene = Scene(**{k: v for k, v in raw.items() if k in known})

            if scene.kind in ("image", "video", "slideshow"):
                has_media = scene.image or scene.video or scene.images
                if not has_media:
                    if strict:
                        raise FileNotFoundError(
                            f"scene {i} ({scene.kind}) has no media. Drop a file into "
                            f"{self.assets_dir}/images (or {self.assets_dir}/clips) "
                            f"or set `image:` / `video:` explicitly."
                        )
                    warnings.append(f"scene {i}: no media -> rendered as a text card")
                    scene.kind = "title"
                    scene.title = scene.title or scene.headline or "Scene"

            scenes.append(scene)

        # ---- durations & narration timeline ---------------------------
        # Cross-fades overlap, so a scene does not start at the sum of the
        # previous durations. The timeline (and therefore every narration
        # offset and caption cue) must account for that overlap, otherwise
        # audio drifts by ~0.6 s per transition.
        durations = [scene.resolved_duration() for scene in scenes]
        t_cfg = self.config.get("transitions") or {}
        t_type = t_cfg.get("type", "fade")
        t_dur = float(t_cfg.get("duration", 0.6))
        if len(durations) > 1:
            t_dur = min(t_dur, min(durations) / 2.5)
        else:
            t_dur = 0.0

        cursor = 0.0
        narration_entries: list[tuple[str, float]] = []
        cues: list = []
        lead = float((self.config.get("audio") or {}).get("narration_lead", 0.45))
        for i, scene in enumerate(scenes):
            dur = durations[i]
            scene.timing = {"start": cursor, "duration": dur}
            cursor += dur - (t_dur if i < len(scenes) - 1 else 0.0)
            if scene.voice and Path(scene.voice).exists():
                vdur = probe(scene.voice).duration
                narration_entries.append((scene.voice, scene.timing["start"] + lead))
                if scene.narration and scene.captions:
                    cues.extend(subtitles.cues_from_text(
                        scene.narration, scene.timing["start"] + lead, min(vdur, dur - lead),
                        max_chars=int(((self.config.get("subtitles") or {}).get("max_chars")) or 84)))
                elif scene.captions and (self.config.get("subtitles") or {}).get("from_audio", False):
                    pass
            elif scene.narration:
                if scene.captions:
                    cues.extend(subtitles.cues_from_text(
                        scene.narration, scene.timing["start"] + lead,
                        max(0.8, dur - lead - 0.3),
                        max_chars=int(((self.config.get("subtitles") or {}).get("max_chars")) or 84)))

        # a single, externally-authored subtitle file always wins
        sub_cfg = self.config.get("subtitles") or {}
        external = self._asset(sub_cfg.get("file"), "audio")
        if external and Path(external).exists():
            cues = subtitles.read_srt(external)

        total = max(cursor, 0.1)
        return Plan(project=self, scenes=scenes, preset=preset, total_duration=total,
                    transition_type=t_type, transition_duration=t_dur,
                    narration_entries=narration_entries, cues=cues, warnings=warnings)


def _first_sentence(text: str, limit: int = 70) -> str:
    """Human-readable scene label from narration (for the manifest/chapters)."""
    text = " ".join((text or "").split())
    if not text:
        return ""
    head = text.split(".")[0].strip()
    if len(head) > limit:
        head = head[: limit - 1].rsplit(" ", 1)[0] + "…"
    return head


def _slugify(text: str) -> str:
    import re

    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s or "video"


# --------------------------------------------------------------------------- #
#  the renderer
# --------------------------------------------------------------------------- #
class VideoFactory:
    def __init__(self, plan: Plan, *, log=print, keep_intermediates: bool = True):
        self.plan = plan
        self.project = plan.project
        self.preset = plan.preset
        self.log = log
        self.keep = keep_intermediates
        self.build = self.project.build_dir
        self.scene_dir = self.build / "scenes"
        self.out_dir = self.project.root / "output"
        self.scene_dir.mkdir(parents=True, exist_ok=True)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.build / "state.json"
        self.state = self._load_state()

    # ---- state / resume ------------------------------------------------- #
    def _load_state(self) -> dict:
        if self.state_file.exists():
            try:
                return json.loads(self.state_file.read_text())
            except json.JSONDecodeError:
                return {}
        return {}

    def _save_state(self):
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(self.state, indent=2))

    # ---- stage 1: scenes ------------------------------------------------ #
    def render_scenes(self, *, force: bool = False) -> list[Path]:
        renderer = SceneRenderer(self.preset, self.scene_dir)
        clips: list[Path] = []
        n = len(self.plan.scenes)
        for scene in self.plan.scenes:
            out = self.scene_dir / f"scene_{scene.index:02d}.mp4"
            fp = scene.fingerprint(self.preset)
            cached = (self.state.get("scenes", {}).get(str(scene.index), {}).get("fingerprint"))
            if out.exists() and cached == fp and not force:
                self.log(f"  [scene {scene.index + 1}/{n}] cached ({scene.kind})")
                clips.append(out)
                continue
            t0 = time.time()
            self.log(f"  [scene {scene.index + 1}/{n}] rendering {scene.kind}"
                     f" — {scene.timing['duration']:.1f}s …")
            try:
                p = renderer.render(scene)
            except Exception as exc:
                self.log(f"  [scene {scene.index + 1}/{n}] FAILED: {exc} -> fallback card")
                fallback = Scene(kind="title", title=scene.title or scene.headline or "Scene",
                                 subtitle="(render fallback)", index=scene.index,
                                 accent=scene.accent)
                p = renderer.render(fallback, dur=scene.timing["duration"] or 5.0)
            clips.append(p)
            self.state.setdefault("scenes", {})[str(scene.index)] = {
                "fingerprint": fp, "file": str(p), "duration": probe(p).duration,
            }
            self._save_state()
            self.log(f"  [scene {scene.index + 1}/{n}] done in {time.time() - t0:.1f}s")
        return clips

    # ---- stage 2: video join (+ subtitles burned in the same pass) ------ #
    def join_video(self, clips: list[Path], *, burn: bool = True) -> Path:
        out = self.build / "video_joined.mp4"
        post: list[str] = []
        font_env = fontconfig_env()
        subtitles_file = None
        sub_cfg = self.project.config.get("subtitles") or {}

        if burn and self.plan.cues and sub_cfg.get("burn_in", True):
            subtitles_file = subtitles.write_ass(
                self.plan.cues, self.build / "captions.ass",
                width=self.preset.width, height=self.preset.height,
                style=_subtitle_style(sub_cfg, self.preset))
            post.append(f"ass='{subtitles._escape_filter_path(str(subtitles_file.resolve()))}'")

        transition = self.plan.transition_type if len(clips) > 1 else "fade"
        td = self.plan.transition_duration

        self.log(f"  joining {len(clips)} scenes "
                 f"(transition={transition}, {td}s, subtitles={'yes' if post else 'no'})…")
        concat_segments(clips, out, preset=self.preset, transition=transition,
                        transition_duration=td, post_filters=post or None,
                        font_env=font_env)
        return out

    # ---- stage 3: audio -------------------------------------------------- #
    def build_audio(self, total: float) -> Path:
        cfg = self.project.config.get("audio") or {}
        self.log("  building narration stem…")
        narration = self.build / "narration.wav"
        global_voice = self.project._asset(cfg.get("voice"), "audio")
        if global_voice and Path(global_voice).exists():
            entries = [(global_voice, float(cfg.get("voice_offset", 0.0)))]
        else:
            entries = self.plan.narration_entries
        build_narration_track(entries, narration, total=total)

        music = self.project._asset(cfg.get("music"), "audio")
        if not music and cfg.get("synth_music", True):
            style = cfg.get("music_style", "calm")
            music = audio_mod.synth_music_bed(total + 2, self.build / "music_bed.wav",
                                             style=style,
                                             bpm=float(cfg.get("bpm", 84)))
            self.log(f"  generated copyright-safe music bed ({style})")
        elif music:
            self.log(f"  using supplied music: {Path(music).name}")

        self.log("  mixing (side-chain ducking under narration)…")
        mixed = audio_mod.mix_voice_music(
            narration, music, self.build / "mix_raw.wav", duration=total,
            music_gain_db=float(cfg.get("music_gain_db", -19)),
            duck=bool(cfg.get("duck", True)),
            voice_gain_db=float(cfg.get("voice_gain_db", 0.0)),
            fade_in=float(cfg.get("fade_in", 1.2)),
            fade_out=float(cfg.get("fade_out", 2.5)),
        )

        target_i = float(cfg.get("target_lufs", -14.0))
        if cfg.get("normalize", True):
            self.log(f"  normalising loudness to {target_i} LUFS…")
            mixed = audio_mod.normalize_audio(mixed, self.build / "master_audio.wav",
                                              target_i=target_i,
                                              true_peak=float(cfg.get("true_peak", -1.5)))
        return Path(mixed)

    # ---- stage 4: final mux --------------------------------------------- #
    def finalize(self, video: Path, audio: Path, *, target_mb: float | None = None) -> Path:
        out = self.out_dir / f"{self.project.slug}-{self.preset.width}x{self.preset.height}.mp4"
        self.log(f"  muxing master -> {out.name}…")
        # video is already encoded to preset; attach audio without re-encoding
        mux_audio(video, audio, out, preset=self.preset, shortest=False)
        info = probe(out)
        if info.duration > probe(video).duration + 0.5:
            # safety: trim to the picture length
            trimmed = self.out_dir / f"_{out.stem}_trim.mp4"
            mux_audio(video, audio, trimmed, preset=self.preset, shortest=True)
            shutil.move(str(trimmed), out)
        return out

    # ---- stage 5: extras ------------------------------------------------- #
    def write_subtitles(self) -> dict:
        sub_cfg = self.project.config.get("subtitles") or {}
        if not self.plan.cues:
            return {}
        style = _subtitle_style(sub_cfg, self.preset)
        base = self.out_dir / f"{self.project.slug}"
        paths = subtitles.write_sidecar(self.plan.cues, base, width=self.preset.width,
                                        height=self.preset.height, style=style,
                                        srt=True, vtt=True, ass=True)
        return {k: str(v) for k, v in paths.items()}

    def make_thumbnail(self) -> Path | None:
        cfg = self.project.config.get("thumbnail") or {}
        if cfg.get("enabled", True) is False:
            return None
        title = cfg.get("title") or self.project.meta.get("title") or "Video"
        image = self.project._asset(cfg.get("image"), "image")
        if not image:
            imgs = self.project.discover_assets("image")
            image = imgs[0] if imgs and cfg.get("use_first_image", False) else None
        pal = graphics.DEFAULT_PALETTE
        if self.project.accent:
            pal = pal.with_accent(_hex(self.project.accent))
        img = graphics.thumbnail((1280, 720), title=title,
                                 subtitle=cfg.get("subtitle", ""),
                                 badge=cfg.get("badge", ""), image=image, palette=pal)
        out = self.out_dir / f"{self.project.slug}-thumbnail.jpg"
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, quality=92, optimize=True)
        return out

    def make_poster(self, video: Path) -> Path:
        return frame_grab(video, float((self.project.config.get("thumbnail") or {})
                                       .get("poster_at", 3.0)),
                          self.output_dir_check() / f"{self.project.slug}-poster.jpg")

    def output_dir_check(self) -> Path:
        self.out_dir.mkdir(parents=True, exist_ok=True)
        return self.out_dir

    # ---- driver ---------------------------------------------------------- #
    def run(self, *, force_scenes: bool = False, burn_subs: bool = True) -> dict:
        t0 = time.time()
        plan = self.plan
        total = plan.total_duration
        self.log(f"\n▶ {plan.project.meta.get('title', plan.project.slug)}")
        self.log(f"  {len(plan.scenes)} scenes · {total/60:.2f} min · "
                 f"{plan.preset.width}x{plan.preset.height} @ {plan.preset.fps}fps")
        for w in plan.warnings:
            self.log(f"  ! {w}")

        clips = self.render_scenes(force=force_scenes)
        video = self.join_video(clips, burn=burn_subs)
        audio_track = self.build_audio(total)
        master = self.finalize(video, audio_track)
        subs = self.write_subtitles()
        thumb = self.make_thumbnail()
        poster = self.make_poster(master)

        result = verify(master, width=self.preset.width, height=self.preset.height,
                        fps=self.preset.fps, min_duration=total - 1.0,
                        max_duration=total + 1.0)
        manifest = {
            "project": plan.project.meta.get("title", plan.project.slug),
            "slug": plan.project.slug,
            "preset": plan.preset.name,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "elapsed_seconds": round(time.time() - t0, 1),
            "master": str(master),
            "duration": plan.total_duration,
            "resolution": f"{plan.preset.width}x{plan.preset.height}",
            "fps": plan.preset.fps,
            "timeline": plan.timeline(),
            "chapters": plan.chapters(),
            "subtitles": subs,
            "thumbnail": str(thumb) if thumb else None,
            "poster": str(poster),
            "verification": {
                "passed": result["passed"],
                "checks": [{"check": c, "ok": ok, "detail": d} for c, ok, d in result["checks"]],
            },
            "warnings": plan.warnings,
        }
        description = (
            f"{plan.project.meta.get('description', '')}\n\n"
            f"CHAPTERS\n{manifest['chapters']}\n"
        ).strip() + "\n"
        (self.out_dir / f"{plan.project.slug}-description.txt").write_text(
            description, encoding="utf-8")
        write_manifest(self.out_dir / f"{plan.project.slug}-manifest.json", manifest)
        self._save_state()
        self.log(f"\n✔ rendered in {manifest['elapsed_seconds']}s -> {master}")
        for c, ok, d in result["checks"]:
            self.log(f"   {'PASS' if ok else 'FAIL'}  {c}: {d}")
        return manifest


def _subtitle_style(cfg: dict, preset: VideoPreset) -> subtitles.SubtitleStyle:
    style = subtitles.DEFAULT_STYLE
    for key, attr in (("font", "font"), ("font_size", "font_size"), ("bold", "bold"),
                      ("outline", "outline"), ("shadow", "shadow"),
                      ("alignment", "alignment"), ("margin_v", "margin_v"),
                      ("max_chars", "max_chars"), ("uppercase", "uppercase"),
                      ("outline_colour", "outline_colour")):
        if key in cfg and cfg[key] is not None:
            setattr(style, attr, cfg[key])
    if cfg.get("primary"):
        style.primary = cfg["primary"]
    return style.scaled(preset.width, preset.height)


def _hex(value: str) -> tuple:
    v = value.lstrip("#")
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


# --------------------------------------------------------------------------- #
#  scaffolding for new projects
# --------------------------------------------------------------------------- #
PROJECT_TEMPLATE = """\
# ─────────────────────────────────────────────────────────────────────────────
#  YouTube long-form video project
#  Everything is optional except `scenes:`. Paths are relative to this folder,
#  or resolved against assets/images · assets/clips · assets/audio.
# ─────────────────────────────────────────────────────────────────────────────
project:
  title: "{title}"
  slug: "{slug}"
  preset: youtube-1080p30        # youtube-1080p30 | 1080p60 | 1440p30 | 4k30 | draft-720p30
  resolution: 1920x1080          # override the preset if you like
  fps: 30
  brand:
    channel: "Your Channel"
    accent: "#FFB03B"
  language: en

audio:
  voice: null                    # optional single full-length voiceover: assets/audio/vo.mp3
  music: null                    # leave null to auto-generate a copyright-safe bed
  synth_music: true
  music_style: calm              # calm | uplifting | cinematic | focus
  music_gain_db: -19
  duck: true                     # side-chain the music under the narration
  normalize: true
  target_lufs: -14.0             # YouTube normalises to about -14 LUFS
  true_peak: -1.5
  narration_lead: 0.45           # silence before each scene's narration starts

subtitles:
  burn_in: true                  # hard-burn captions into the picture
  language: en
  max_chars: 84
  font: DejaVuSans-Bold
  font_size: 54                  # at 1080p, scales with resolution
  outline: 3
  shadow: 1
  margin_v: 70
  uppercase: false

transitions:
  type: fade                     # any ffmpeg xfade transition name
  duration: 0.6

thumbnail:
  enabled: true
  title: "{title}"
  subtitle: ""
  badge: "NEW"
  image: null                    # assets/images/thumb.jpg

scenes:
  - kind: title
    title: "{title}"
    subtitle: "A short, compelling hook line"
    duration: 5
    motion: zoom_out
    narration: "Welcome. In this video we are going to cover the essentials, step by step."

  - kind: chapter
    number: "01"
    title: "Where it all starts"
    subtitle: "The foundations"
    motion: zoom_out
    narration: "Let us start with the foundations."

  - kind: bullets
    headline: "Three things that matter"
    bullets:
      - "Clarity beats cleverness"
      - "Every second must earn attention"
      - "Consistency compounds"
    narration: "Three things matter more than anything else here."

  - kind: image
    image: null                  # auto-picks the first file in assets/images
    title: "Show, don't tell"
    layout: lower
    motion: zoom_in
    duration: 6
    narration: "Show the work. Let the viewer see the result."

  - kind: outro
    title: "Thanks for watching"
    subtitle: "Subscribe for the next one"
    duration: 4

  - kind: endscreen
    title: "Your Channel"
    subtitle: "Watch next"
    duration: 10
"""


def scaffold_project(name: str, *, base: Path | None = None) -> Path:
    base = Path(base) if base else PROJECTS_DIR
    slug = _slugify(name)
    root = base / slug
    if (root / "project.yaml").exists():
        raise FileExistsError(f"{root/'project.yaml'} already exists")
    for sub in ("assets/images", "assets/clips", "assets/audio", "assets/fonts",
                "build", "output"):
        (root / sub).mkdir(parents=True, exist_ok=True)
    (root / "project.yaml").write_text(
        PROJECT_TEMPLATE.format(title=name, slug=slug), encoding="utf-8")
    return root


def list_projects() -> list[Path]:
    if not PROJECTS_DIR.is_dir():
        return []
    return sorted(p.parent for p in PROJECTS_DIR.glob("*/project.yaml"))
