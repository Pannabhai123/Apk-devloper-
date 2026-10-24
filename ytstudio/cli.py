"""Command line interface: ``python -m ytstudio <command>``."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from . import __version__


# --------------------------------------------------------------------------- #
#  pretty output (rich if present, plain otherwise)
# --------------------------------------------------------------------------- #
def _console():
    try:
        from rich.console import Console

        return Console(highlight=False)
    except Exception:
        return None


C = _console()


def _p(text: str = ""):
    if C:
        C.print(text)
    else:
        print(text)


# --------------------------------------------------------------------------- #
#  commands
# --------------------------------------------------------------------------- #
def cmd_doctor(args) -> int:
    from .tools import doctor

    rep = doctor()
    _p(f"\n[bold]ytstudio {__version__}[/bold] — environment report\n" if C
       else f"\nytstudio {__version__} — environment report\n")
    color = {"PASS": "green", "WARN": "yellow", "FAIL": "red", "INFO": "cyan"}
    for status, area, detail in rep.rows:
        if C:
            _p(f"  [{color.get(status, 'white')}]{{:4}}[/]  {area:<28} {detail}"
               .format(status))
        else:
            print(f"  {status:4}  {area:<28} {detail}")
    _p(f"\n  {rep.ok} pass · {rep.warn} warn · {rep.fail} fail · {rep.info} info")
    return 0 if rep.fail == 0 else 1


def cmd_presets(args) -> int:
    from .presets import PRESETS

    _p("\n[bold]Export presets[/bold]\n" if C else "\nExport presets\n")
    for name, p in PRESETS.items():
        print(f"  {name:<22} {p.size:<10} {p.fps:>3}fps  {p.codec} crf={p.crf} "
              f"{p.audio_codec} {p.audio_bitrate}  ({p.aspect})")
    print("\n  loudness target: -14 LUFS integrated, -1.5 dBTP (YouTube reference)")
    return 0


def cmd_init(args) -> int:
    from .engine import scaffold_project

    root = scaffold_project(args.name, base=Path(args.dir) if args.dir else None)
    _p(f"\n✔ project created: {root}")
    _p("""
  next:
   1. edit  project.yaml           (title, scenes, narration text)
   2. drop  assets/images/*.jpg    background stills / B-roll
      drop  assets/clips/*.mp4     video B-roll (optional)
      drop  assets/audio/vo.mp3    recorded voiceover (optional)
   3. run:  .venv/bin/python -m ytstudio render """ + str(root) + """
""")
    return 0


def cmd_plan(args) -> int:
    from .engine import Project
    from .presets import get_preset

    proj = Project.load(args.project)
    plan = proj.plan(preset_override=args.preset, draft=args.draft)
    p = plan.preset
    _p(f"\n[bold]{proj.meta.get('title', proj.slug)}[/bold]" if C
       else f"\n{proj.meta.get('title', proj.slug)}")
    _p(f"  preset   {p.name}  {p.size} @ {p.fps}fps  {p.codec} crf={p.crf}")
    _p(f"  duration {plan.total_duration/60:.2f} min  ({plan.total_duration:.1f}s)")
    _p(f"  scenes   {len(plan.scenes)}   narration clips: {len(plan.narration_entries)}"
       f"   caption cues: {len(plan.cues)}")
    _p("")
    for row in plan.timeline():
        _p(f"  {row['start']:>7.1f}s  {row['duration']:>6.1f}s  {row['kind']:<10} "
           f"{(row['title'] or '').strip()[:64]}")
    if plan.warnings:
        _p("\n  warnings:")
        for w in plan.warnings:
            _p(f"   ! {w}")
    if args.json:
        print(json.dumps({"total": plan.total_duration, "timeline": plan.timeline()},
                         indent=2))
    return 0


def cmd_render(args) -> int:
    from .engine import Project, VideoFactory

    proj = Project.load(args.project)
    plan = proj.plan(preset_override=args.preset, draft=args.draft,
                     strict=not args.allow_missing_media)
    factory = VideoFactory(plan, log=_p)
    manifest = factory.run(force_scenes=args.force, burn_subs=not args.no_subs)
    if args.json:
        print(json.dumps(manifest, indent=2))
    return 0 if manifest["verification"]["passed"] else 2


def cmd_verify(args) -> int:
    from .probe import verify

    res = verify(args.file, width=args.width, height=args.height, fps=args.fps,
                 min_duration=args.min_duration, require_audio=not args.no_audio)
    info = res["info"]
    _p(f"\n{info.summary()}")
    for name, ok, detail in res["checks"]:
        tag = "[green]PASS[/green]" if ok and C else ("PASS" if ok else "FAIL")
        _p(f"  {tag}  {name}: {detail}")
    if args.grab:
        from .probe import frame_grab

        for t in [float(x) for x in args.grab.split(",")]:
            p = frame_grab(args.file, t, Path(args.out or "/tmp") / f"frame_{t:g}s.png")
            _p(f"  frame @{t}s -> {p}")
    _p("\n✔ all checks passed" if res["passed"] else "\n✘ verification failed")
    return 0 if res["passed"] else 2


def cmd_sample(args) -> int:
    from .sample import build_sample

    return build_sample(preset=args.preset, draft=args.draft,
                        keep=not args.clean, clean_video=args.clean,
                        force=args.force)


def cmd_chapters(args) -> int:
    from .engine import Project

    plan = Project.load(args.project).plan()
    text = plan.chapters(min_gap=args.min_gap)
    if not text:
        _p("no titled scenes - add `title:` to your scenes to get chapters")
        return 1
    _p("\n" + text + "\n")
    return 0


def cmd_assets(args) -> int:
    from .engine import Project

    proj = Project.load(args.project)
    for kind in ("image", "video", "audio"):
        files = proj.discover_assets(kind)
        _p(f"\n  {kind}s ({len(files)}):")
        for f in files:
            _p(f"    {f}")
    if not any(proj.discover_assets(k) for k in ("image", "video", "audio")):
        _p("\n  no assets found — drop files into assets/images, assets/clips, assets/audio")
    return 0


def cmd_voice(args) -> int:
    """Generate a narration track from text (offline or API engine)."""
    from .audio import tts, tts_available

    text = args.text
    if args.file:
        text = Path(args.file).read_text(encoding="utf-8")
    if not text:
        _p("nothing to say — pass --text or --file")
        return 2
    engines = tts_available()
    _p("  engines: " + ", ".join(f"{k}={'yes' if v else 'no'}" for k, v in engines.items()))
    out = Path(args.out or "narration.wav")
    p = tts(text, out, engine=args.engine, voice=args.voice)
    _p(f"✔ voiceover -> {p}")
    return 0


def cmd_remotion(args) -> int:
    """Render a Remotion composition (animated titles / intros)."""
    from .remotion import render_composition, remotion_status

    status = remotion_status()
    _p("\nRemotion status:")
    for k, v in status.items():
        _p(f"  {k:<16} {v}")
    if not status.get("renderable"):
        _p("\n  Remotion is not renderable in this environment — use the FFmpeg "
           "scene renderer (ytstudio render).")
        return 1
    if args.list:
        return 0
    if not args.composition:
        _p("\n  pass --composition <id> --out <file.mp4>")
        return 0
    out = render_composition(args.composition, args.out, props=json.loads(args.props or "{}"),
                             preset=args.preset)
    _p(f"\n✔ {out}")
    return 0


def cmd_scaffold_demo(args) -> int:
    from .sample import write_demo_project

    root = write_demo_project(force=args.force)
    _p(f"✔ demo project at {root}")
    return 0


# --------------------------------------------------------------------------- #
#  argument parsing
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="ytstudio",
        description="YouTube long-form video production system (FFmpeg + Remotion)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  python -m ytstudio doctor
  python -m ytstudio sample
  python -m ytstudio init "Quantum Computing Explained"
  python -m ytstudio plan projects/quantum-computing-explained
  python -m ytstudio render projects/quantum-computing-explained --draft
  python -m ytstudio render projects/quantum-computing-explained
  python -m ytstudio verify output/quantum-computing-explained-1920x1080.mp4
""")
    ap.add_argument("--version", action="version", version=f"ytstudio {__version__}")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("doctor", help="inspect the environment and installed tools")
    p.set_defaults(func=cmd_doctor)

    p = sub.add_parser("presets", help="list export presets")
    p.set_defaults(func=cmd_presets)

    p = sub.add_parser("init", help="scaffold a new video project")
    p.add_argument("name")
    p.add_argument("--dir", help="parent folder (default: ./projects)")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("plan", help="show the timeline without rendering")
    p.add_argument("project")
    p.add_argument("--preset")
    p.add_argument("--draft", action="store_true")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_plan)

    p = sub.add_parser("render", help="render a project")
    p.add_argument("project")
    p.add_argument("--preset", help="override the project preset")
    p.add_argument("--draft", action="store_true", help="fast 720p preview encode")
    p.add_argument("--force", action="store_true", help="re-render cached scenes")
    p.add_argument("--no-subs", action="store_true", help="do not burn subtitles")
    p.add_argument("--allow-missing-media", action="store_true",
                   help="fall back to text cards instead of failing")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_render)

    p = sub.add_parser("verify", help="validate a rendered file")
    p.add_argument("file")
    p.add_argument("--width", type=int)
    p.add_argument("--height", type=int)
    p.add_argument("--fps", type=float)
    p.add_argument("--min-duration", type=float)
    p.add_argument("--no-audio", action="store_true")
    p.add_argument("--grab", help="comma separated timestamps to export frames")
    p.add_argument("--out", help="folder for grabbed frames")
    p.set_defaults(func=cmd_verify)

    p = sub.add_parser("sample", help="render the built-in end-to-end demo video")
    p.add_argument("--preset")
    p.add_argument("--draft", action="store_true")
    p.add_argument("--force", action="store_true", help="re-render cached scenes")
    p.add_argument("--clean", action="store_true", help="delete intermediates afterwards")
    p.set_defaults(func=cmd_sample)

    p = sub.add_parser("chapters", help="print YouTube chapter timestamps")
    p.add_argument("project")
    p.add_argument("--min-gap", type=float, default=10.0)
    p.set_defaults(func=cmd_chapters)

    p = sub.add_parser("assets", help="list assets discovered for a project")
    p.add_argument("project")
    p.set_defaults(func=cmd_assets)

    p = sub.add_parser("voice", help="synthesise narration from text")
    p.add_argument("--text")
    p.add_argument("--file")
    p.add_argument("--voice")
    p.add_argument("--engine", default="auto")
    p.add_argument("--out")
    p.set_defaults(func=cmd_voice)

    p = sub.add_parser("remotion", help="inspect / render Remotion compositions")
    p.add_argument("--list", action="store_true")
    p.add_argument("--composition")
    p.add_argument("--out", default="output/remotion.mp4")
    p.add_argument("--props", help="JSON props")
    p.add_argument("--preset", default="youtube-1080p30")
    p.set_defaults(func=cmd_remotion)

    p = sub.add_parser("demo-project", help="write the demo project folder only")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_scaffold_demo)
    return ap


def main(argv=None) -> int:
    ap = build_parser()
    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"\n✘ {type(exc).__name__}: {exc}", file=sys.stderr)
        if "-v" in sys.argv or "--traceback" in sys.argv:
            raise
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
