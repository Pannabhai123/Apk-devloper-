"""Tool discovery and capability detection.

Every external dependency is resolved here, once, so the rest of the package
never has to guess where a binary lives.  Resolution order is always:

1. explicit environment variable   (YTV_FFMPEG, YTV_FFPROBE, YTV_CHROME ...)
2. project-local install           (``<repo>/.tools/...`` written by bootstrap.sh)
3. anything on ``$PATH``           (system package manager install)
4. Python-wheel fallback           (imageio-ffmpeg ships a static FFmpeg)
"""

from __future__ import annotations

import functools
import os
import platform
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOOLS_DIR = Path(os.environ.get("YTV_TOOLS_DIR", REPO_ROOT / ".tools"))
FONTS_DIR = Path(os.environ.get("YTV_FONTS_DIR", REPO_ROOT / "fonts"))
PROJECTS_DIR = Path(os.environ.get("YTV_PROJECTS_DIR", REPO_ROOT / "projects"))
REMOTION_DIR = Path(os.environ.get("YTV_REMOTION_DIR", REPO_ROOT / "remotion-studio"))


# --------------------------------------------------------------------------- #
#  generic helpers
# --------------------------------------------------------------------------- #
def run(cmd, *, capture=True, check=False, timeout=600, env=None, text=True):
    """Thin, safe subprocess wrapper (never uses a shell)."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    res = subprocess.run(
        [str(c) for c in cmd],
        capture_output=capture,
        text=text,
        check=False,
        timeout=timeout,
        env=full_env,
    )
    if check and res.returncode != 0:
        tail = ((res.stderr or "") + (res.stdout or "")).strip().splitlines()[-12:]
        raise RuntimeError(
            f"command failed ({res.returncode}): {' '.join(str(c) for c in cmd[:6])} …\n"
            + "\n".join(tail)
        )
    return res


def _first_existing(*candidates: str | Path | None) -> Path | None:
    for c in candidates:
        if not c:
            continue
        p = Path(c).expanduser()
        if p.is_file() and os.access(p, os.X_OK):
            return p
    return None


@functools.lru_cache(maxsize=1)
def ffmpeg() -> Path | None:
    env = os.environ.get("YTV_FFMPEG")
    local = TOOLS_DIR / "ffmpeg"
    wheel = None
    try:  # imageio-ffmpeg bundles a full static FFmpeg 7.x
        import imageio_ffmpeg

        wheel = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        wheel = None
    return _first_existing(env, local, shutil.which("ffmpeg"), wheel)


@functools.lru_cache(maxsize=1)
def ffprobe() -> Path | None:
    env = os.environ.get("YTV_FFPROBE")
    local = TOOLS_DIR / "ffprobe"
    return _first_existing(env, local, shutil.which("ffprobe"))


@functools.lru_cache(maxsize=1)
def chrome() -> Path | None:
    """Headless Chromium used by Remotion."""
    env = os.environ.get("YTV_CHROME")
    return _first_existing(
        env,
        TOOLS_DIR / "chromium" / "chromium",
        TOOLS_DIR / "chromium" / "chrome",
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        "/usr/bin/chromium",
    )


def chrome_env() -> dict:
    """LD_LIBRARY_PATH needed by the bundled Chromium (ships its own NSS libs)."""
    lib = TOOLS_DIR / "chromium" / "lib"
    env = {}
    if lib.is_dir():
        prev = os.environ.get("LD_LIBRARY_PATH", "")
        env["LD_LIBRARY_PATH"] = f"{lib}:{prev}" if prev else str(lib)
    return env


@functools.lru_cache(maxsize=1)
def node() -> Path | None:
    p = shutil.which("node")
    return Path(p) if p else None


@functools.lru_cache(maxsize=1)
def npm() -> Path | None:
    p = shutil.which("npm")
    return Path(p) if p else None


def remotion_cli() -> Path | None:
    cli = REMOTION_DIR / "node_modules" / ".bin" / "remotion"
    return cli if cli.exists() else None


def version_of(exe: Path | None, args=("-version",)) -> str:
    if not exe:
        return "not found"
    try:
        out = run([exe, *args], timeout=30).stdout or ""
        return out.splitlines()[0].strip() if out else "unknown"
    except Exception as exc:  # pragma: no cover - defensive
        return f"error: {exc}"


# --------------------------------------------------------------------------- #
#  FFmpeg capability probe
# --------------------------------------------------------------------------- #
@functools.lru_cache(maxsize=1)
def ffmpeg_capabilities() -> dict:
    """What this particular FFmpeg build can actually do."""
    exe = ffmpeg()
    caps: dict = {
        "path": str(exe) if exe else None,
        "version": version_of(exe),
        "encoders": set(),
        "filters": set(),
        "build_options": set(),
    }
    if not exe:
        return caps
    try:
        enc = run([exe, "-hide_banner", "-encoders"], timeout=60).stdout or ""
        caps["encoders"] = {
            line.split()[1]
            for line in enc.splitlines()
            if line.startswith(" ") and len(line.split()) > 1
        }
    except Exception:
        pass
    try:
        flt = run([exe, "-hide_banner", "-filters"], timeout=60).stdout or ""
        caps["filters"] = {
            line.split()[1]
            for line in flt.splitlines()
            if line.startswith(" ") and len(line.split()) > 2
        }
    except Exception:
        pass
    try:
        ver = run([exe, "-hide_banner", "-version"], timeout=30).stdout or ""
        caps["build_options"] = {
            tok for line in ver.splitlines() for tok in line.split() if tok.startswith("--enable-")
        } | {
            tok for line in ver.splitlines() for tok in line.split() if tok.startswith("--enable-")
        }
    except Exception:
        pass
    return caps


def has_encoder(name: str) -> bool:
    return name in ffmpeg_capabilities()["encoders"]


def has_filter(name: str) -> bool:
    return name in ffmpeg_capabilities()["filters"]


def hwaccel_available() -> dict:
    """Report which hardware encoders are genuinely usable."""
    return {
        "nvenc": has_encoder("h264_nvenc") or has_encoder("hevc_nvenc"),
        "vaapi": has_encoder("h264_vaapi") or has_encoder("hevc_vaapi"),
        "qsv": has_encoder("h264_qsv") or has_encoder("hevc_qsv"),
        "videotoolbox": has_encoder("h264_videotoolbox"),
        "amf": has_encoder("h264_amf"),
    }


# --------------------------------------------------------------------------- #
#  Fonts
# --------------------------------------------------------------------------- #
FONT_ALIASES = {
    "sans": ["Inter", "Montserrat", "DejaVuSans", "Arial", "Helvetica"],
    "display": ["BebasNeue", "Oswald", "MontserratExtraBold", "DejaVuSansDisplay", "DejaVuSans-Bold"],
    "serif": ["DejaVuSerif", "Georgia", "Times"],
    "mono": ["DejaVuSansMono", "Courier"],
}


@functools.lru_cache(maxsize=4)
def fontconfig_env(font_dir: Path | None = None) -> dict:
    """Point fontconfig (used by libass/drawtext) at the repo font folders.

    This container ships zero system fonts, so without this libass cannot
    resolve a font family and renders boxes. We generate a private fonts.conf.
    """
    conf_dir = TOOLS_DIR / "fontconfig"
    conf_dir.mkdir(parents=True, exist_ok=True)
    cache = Path("/tmp/fontconfig-cache")
    cache.mkdir(parents=True, exist_ok=True)
    dirs = [Path(font_dir) if font_dir else FONTS_DIR]
    try:
        import matplotlib

        dirs.append(Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf")
    except Exception:
        pass
    for extra in ("/usr/share/fonts", "/usr/local/share/fonts", str(Path.home() / ".fonts")):
        if Path(extra).is_dir():
            dirs.append(Path(extra))
    uniq = []
    for d in dirs:
        if d.is_dir() and d not in uniq:
            uniq.append(d)
    body = "\n".join(f"  <dir>{d}</dir>" for d in uniq)
    conf = conf_dir / "fonts.conf"
    conf.write_text(
        '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n'
        "<fontconfig>\n"
        f"{body}\n"
        f"  <cachedir>{cache}</cachedir>\n"
        '  <match target="pattern"><edit name="dpi" mode="assign"><double>96</double></edit></match>\n'
        "</fontconfig>\n"
    )
    return {"FONTCONFIG_FILE": str(conf), "FONTCONFIG_PATH": str(conf_dir)}


def find_font(family: str | None = None, *, weight: str = "regular", fallback: str = "sans") -> Path:
    """Resolve a font file, preferring repo-local fonts over system fonts."""
    names = [family] if family else []
    names += FONT_ALIASES.get(fallback, FONT_ALIASES["sans"])
    searched: list[Path] = []

    if FONTS_DIR.is_dir():
        for name in names:
            if not name:
                continue
            stem = name.lower().replace(" ", "")
            for cand in sorted(FONTS_DIR.glob("*.ttf")) + sorted(FONTS_DIR.glob("*.otf")):
                cstem = cand.stem.lower().replace(" ", "").replace("-", "").replace("_", "")
                if cstem.startswith(stem) or stem in cstem:
                    # prefer requested weight when several faces exist
                    if weight and weight.lower() in cstem:
                        return cand
                    searched.append(cand)
            if searched:
                return searched[0]

    # packaged DejaVu faces are always available (matplotlib ships them)
    try:
        import matplotlib

        mpl_fonts = Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf"
        want = {
            "sans": "DejaVuSans.ttf",
            "display": "DejaVuSansDisplay.ttf",
            "serif": "DejaVuSerif.ttf",
            "mono": "DejaVuSansMono.ttf",
        }[fallback if not family else "sans"]
        if weight.lower() == "bold":
            want = want.replace(".ttf", "-Bold.ttf")
        if (mpl_fonts / want).exists():
            return mpl_fonts / want
    except Exception:
        pass
    raise FileNotFoundError("No usable font found; run ./bootstrap.sh to install fonts")


# --------------------------------------------------------------------------- #
#  Environment report (used by `ytv doctor`)
# --------------------------------------------------------------------------- #
@dataclass
class DoctorReport:
    rows: list = field(default_factory=list)
    ok: int = 0
    warn: int = 0
    fail: int = 0
    info: int = 0

    def add(self, status: str, area: str, detail: str):
        self.rows.append((status, area, detail))
        if status == "PASS":
            self.ok += 1
        elif status == "WARN":
            self.warn += 1
        elif status == "FAIL":
            self.fail += 1
        else:
            self.info += 1


def doctor() -> DoctorReport:
    rep = DoctorReport()
    caps = ffmpeg_capabilities()

    rep.add("PASS", "OS", f"{platform.system()} {platform.release()} ({platform.machine()})")
    try:
        import multiprocessing as mp

        rep.add("PASS", "CPU", f"{mp.cpu_count()} logical cores")
    except Exception:
        pass
    try:
        total = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 2**30
        rep.add("PASS", "RAM", f"{total:.1f} GiB")
    except Exception:
        pass
    try:
        st = os.statvfs(str(REPO_ROOT))
        rep.add("PASS", "Disk free", f"{st.f_bavail * st.f_frsize / 2**30:.1f} GiB")
    except Exception:
        pass

    import sys

    rep.add("PASS", "Python", f"{sys.version.split()[0]} @ {sys.executable}")

    # ffmpeg
    if ffmpeg():
        rep.add("PASS", "FFmpeg", caps["version"])
        for enc in ("libx264", "aac"):
            rep.add("PASS" if has_encoder(enc) else "FAIL", f"  encoder {enc}",
                    "available" if has_encoder(enc) else "MISSING")
        for flt in ("subtitles", "ass", "loudnorm", "xfade", "zoompan", "sidechaincompress"):
            rep.add("PASS" if has_filter(flt) else "WARN", f"  filter {flt}",
                    "available" if has_filter(flt) else "MISSING")
        rep.add("PASS" if has_filter("subtitles") else "WARN", "Subtitles",
                "libass burn-in supported" if has_filter("subtitles") else "no libass")
    else:
        rep.add("FAIL", "FFmpeg", "not found - run ./bootstrap.sh")

    rep.add("PASS" if ffprobe() else "WARN", "ffprobe",
            version_of(ffprobe()) if ffprobe() else "not found (fallback probing active)")

    rep.add("PASS" if node() else "WARN", "Node.js",
            version_of(node(), ("-v",)) if node() else "not found")
    rep.add("PASS" if npm() else "WARN", "npm", version_of(npm(), ("-v",)) if npm() else "not found")
    rep.add("PASS" if remotion_cli() else "WARN", "Remotion",
            f"installed at {REMOTION_DIR}" if remotion_cli() else "not installed")
    rep.add("PASS" if chrome() else "WARN", "Chromium (Remotion)",
            version_of(chrome(), ("--version",)) if chrome() else "not found")

    hw = hwaccel_available()
    active = [k for k, v in hw.items() if v]
    if active:
        rep.add("PASS", "GPU accel", f"encoders present: {', '.join(active)}")
    else:
        rep.add("WARN", "GPU accel", "no hardware encoder - CPU x264 fallback (expected in containers)")

    # python libs
    for mod, label in [
        ("numpy", "numpy"), ("PIL", "Pillow"), ("cv2", "OpenCV"), ("scipy", "SciPy"),
        ("imageio", "imageio"), ("imageio_ffmpeg", "imageio-ffmpeg"),
        ("moviepy", "MoviePy"), ("pydub", "pydub"), ("soundfile", "soundfile"),
        ("mutagen", "mutagen"), ("yaml", "PyYAML"),
    ]:
        try:
            m = __import__(mod)
            v = getattr(m, "__version__", "")
            rep.add("PASS", f"  lib {label}", v or "installed")
        except Exception:
            rep.add("WARN", f"  lib {label}", "not importable")

    # optional / paid extras
    rep.add("INFO", "ASR (faster-whisper)", "optional - model download required")
    rep.add("INFO", "TTS (piper/elevenlabs/openai)", "optional - needs models/API key")
    try:
        if find_font():
            rep.add("PASS", "Fonts", str(FONTS_DIR.relative_to(REPO_ROOT)))
    except Exception:
        rep.add("WARN", "Fonts", "no font files available")

    # network
    import socket

    for host, label in [("pypi.org", "PyPI"), ("registry.npmjs.org", "npm"), ("github.com", "GitHub")]:
        try:
            socket.setdefaulttimeout(4)
            socket.create_connection((host, 443), timeout=4).close()
            rep.add("PASS", f"Network {label}", "reachable")
        except Exception:
            rep.add("WARN", f"Network {label}", "unreachable")
    return rep
