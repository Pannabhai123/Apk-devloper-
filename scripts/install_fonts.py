#!/usr/bin/env python3
"""Install real web fonts for titles/subtitles and convert them for FFmpeg.

Why this exists: this container has **zero** system fonts, so libass/FreeType
would fall back to boxes. Fontsource packages are fetched with ``npm pack``
(npm is the only fallback registry reachable from a locked-down sandbox),
then the WOFF files are converted to plain TTF with fontTools because
FreeType cannot read WOFF containers directly.
"""

from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "fonts"

# package -> [(remote weight/style, local filename stem)]
WANTED = {
    "@fontsource/inter": [
        ("inter-latin-400-normal", "Inter-Regular"),
        ("inter-latin-600-normal", "Inter-SemiBold"),
        ("inter-latin-700-normal", "Inter-Bold"),
        ("inter-latin-900-normal", "Inter-Black"),
    ],
    "@fontsource/montserrat": [
        ("montserrat-latin-700-normal", "MontserratBold-Bold"),
        ("montserrat-latin-900-normal", "MontserratExtraBold-ExtraBold"),
    ],
    "@fontsource/bebas-neue": [
        ("bebas-neue-latin-400-normal", "BebasNeue-Regular"),
    ],
    "@fontsource/oswald": [
        ("oswald-latin-600-normal", "Oswald-SemiBold"),
    ],
    "@fontsource/jetbrains-mono": [
        ("jetbrains-mono-latin-400-normal", "JetBrainsMono-Regular"),
    ],
}


def log(msg: str):
    print(f"[fonts] {msg}", flush=True)


def convert(woff_bytes: bytes, out_ttf: Path) -> bool:
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        log("fontTools missing - run: pip install fonttools brotli")
        return False
    try:
        font = TTFont(io.BytesIO(woff_bytes))
        font.flavor = None            # drop the woff wrapper -> plain sfnt
        font.save(out_ttf)
        return True
    except Exception as exc:
        log(f"convert failed for {out_ttf.name}: {exc}")
        return False


def fetch_package(pkg: str, tmp: Path) -> Path | None:
    try:
        res = subprocess.run(["npm", "pack", pkg, "--pack-destination", str(tmp)],
                             capture_output=True, text=True, timeout=300)
        if res.returncode != 0:
            log(f"npm pack failed for {pkg}: {res.stderr.strip()[:200]}")
            return None
        name = res.stdout.strip().splitlines()[-1].strip()
        tgz = tmp / name
        return tgz if tgz.exists() else None
    except Exception as exc:
        log(f"npm pack error for {pkg}: {exc}")
        return None


def main() -> int:
    FONTS.mkdir(parents=True, exist_ok=True)
    installed = 0
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for pkg, faces in WANTED.items():
            tgz = fetch_package(pkg, tmp)
            if not tgz:
                continue
            with tarfile.open(tgz) as tar:
                members = {m.name: m for m in tar.getmembers()}
                for remote, local in faces:
                    member = next(
                        (m for n, m in members.items()
                         if n.endswith(f"/{remote}.woff") or n.endswith(f"/{remote}.woff2")),
                        None)
                    if not member:
                        log(f"{pkg}: no face {remote}")
                        continue
                    data = tar.extractfile(member).read()
                    out = FONTS / f"{local}.ttf"
                    if convert(data, out):
                        installed += 1
                        log(f"installed {out.name}")

    # DejaVu faces are guaranteed locally (matplotlib ships them) - copy in so
    # fontconfig and Remotion can both see a dependable fallback.
    try:
        import matplotlib

        src = Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf"
        for f in src.glob("DejaVu*.ttf"):
            dst = FONTS / f.name
            if not dst.exists():
                shutil.copyfile(f, dst)
                installed += 1
                log(f"installed {dst.name}")
    except Exception as exc:
        log(f"DejaVu copy skipped: {exc}")

    log(f"done: {installed} font files in {FONTS}")
    return 0 if installed else 1


if __name__ == "__main__":
    sys.exit(main())
