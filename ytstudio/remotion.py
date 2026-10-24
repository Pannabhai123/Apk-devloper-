"""Remotion bridge: React-driven motion graphics rendered inside the sandbox.

Remotion normally downloads a Chrome Headless Shell. That download host is not
reachable from this environment, so ``bootstrap.sh`` extracts the Chromium that
``@sparticuz/chromium`` ships inside its npm tarball and points Remotion at it
with ``--browser-executable``. Everything else (bundling, rendering, encoding)
is stock Remotion.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from .presets import get_preset
from .tools import REMOTION_DIR, TOOLS_DIR, chrome, chrome_env, node, npm, remotion_cli, run


def remotion_status() -> dict:
    cli = remotion_cli()
    chrome_path = chrome()
    status = {
        "node": str(node() or "missing"),
        "npm": str(npm() or "missing"),
        "studio": str(REMOTION_DIR),
        "installed": bool(cli),
        "composition_entry": str(REMOTION_DIR / "src" / "index.ts"),
        "chrome": str(chrome_path or "missing"),
        "renderable": False,
        "note": "",
    }
    if not cli:
        status["note"] = "run ./bootstrap.sh (npm install in remotion-studio)"
        return status
    if not chrome_path:
        status["note"] = "no Chromium binary available"
        return status
    env = os.environ.copy()
    env.update(chrome_env())
    try:
        res = subprocess.run([str(chrome_path), "--version"], capture_output=True,
                             text=True, timeout=60, env=env)
        works = res.returncode == 0
        status["chrome_version"] = (res.stdout or res.stderr).strip()
        status["renderable"] = works
        if not works:
            status["note"] = "Chromium failed to start (missing shared libs?)"
    except Exception as exc:
        status["note"] = f"Chromium launch failed: {exc}"
    return status


def list_compositions() -> list[str]:
    cli = remotion_cli()
    if not cli:
        return []
    env = os.environ.copy()
    env.update(chrome_env())
    chrome_path = chrome()
    cmd = [str(cli), "compositions", str(REMOTION_DIR / "src" / "index.ts")]
    if chrome_path:
        cmd += [f"--browser-executable={chrome_path}"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=600,
                             cwd=str(REMOTION_DIR), env=env)
        return [line.strip() for line in (res.stdout or "").splitlines() if line.strip()]
    except Exception:
        return []


def render_composition(composition: str, out: str | Path, *, props: dict | None = None,
                       preset: str | None = None, frames: str | None = None,
                       timeout: int = 7200) -> Path:
    """Render a Remotion composition to MP4 using our Chromium."""
    status = remotion_status()
    if not status["renderable"]:
        raise RuntimeError(f"Remotion not renderable: {status.get('note')}")

    out = Path(out)
    if not out.is_absolute():
        out = REMOTION_DIR.parent / out
    out.parent.mkdir(parents=True, exist_ok=True)

    cli = remotion_cli()
    env = os.environ.copy()
    env.update(chrome_env())
    cmd = [str(cli), "render", str(REMOTION_DIR / "src" / "index.ts"), composition,
           str(out), f"--browser-executable={chrome()}", "--concurrency=2",
           "--log=warn"]
    if preset:
        p = get_preset(preset)
        cmd += [f"--crf={p.crf}"]
    if frames:
        cmd.append(f"--frames={frames}")
    if props:
        cmd += ["--props", json.dumps(props)]

    res = subprocess.run(cmd, cwd=str(REMOTION_DIR), env=env, capture_output=True,
                         text=True, timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(f"remotion render failed:\n{(res.stderr or res.stdout)[-2000:]}")
    if not out.exists():
        raise RuntimeError("remotion reported success but produced no file")
    return out


def remotion_scene_props(scene, project_title: str = "") -> dict:
    """Map a ytstudio Scene onto the Remotion TitleCard/Intro props."""
    return {
        "title": scene.title or scene.headline or project_title,
        "subtitle": scene.subtitle or scene.body or "",
        "accent": scene.accent or "#FFB03B",
        "channel": project_title,
    }
