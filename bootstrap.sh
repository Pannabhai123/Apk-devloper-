#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  bootstrap.sh — install and verify the whole video-production toolchain.
#
#  The sandbox this system was built in blocks Debian apt repositories, so
#  binaries come from the two reachable registries (PyPI + npm) instead of
#  `apt-get install`. On a normal machine this script still works and will
#  simply skip anything already present on $PATH.
#
#  Usage:  ./bootstrap.sh [--force]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"
TOOLS="$ROOT/.tools"
FONTS="$ROOT/fonts"
VENV="$ROOT/.venv"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

say()  { printf '\033[1;36m[bootstrap]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m  ✘ %s\033[0m\n' "$*" >&2; exit 1; }

mkdir -p "$TOOLS" "$FONTS" "$ROOT/projects" "$ROOT/output"

# ── 1. Python environment ───────────────────────────────────────────────────
say "Python environment"
if [[ ! -d "$VENV" ]]; then
  python3 -m venv "$VENV" || die "python3-venv missing (apt-get install python3-venv)"
fi
"$VENV/bin/pip" install --quiet --upgrade pip setuptools wheel
"$VENV/bin/pip" install --quiet -r requirements.txt && ok "python packages installed"
PY="$VENV/bin/python"

# ── 2. FFmpeg ───────────────────────────────────────────────────────────────
say "FFmpeg"
if command -v ffmpeg >/dev/null 2>&1 && [[ $FORCE -eq 0 ]]; then
  ok "system ffmpeg: $(command -v ffmpeg)"
else
  # imageio-ffmpeg ships a complete static FFmpeg (libx264/libass/loudnorm)
  WHEEL_FF="$("$PY" -c 'import imageio_ffmpeg,sys; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || true)"
  if [[ -n "${WHEEL_FF:-}" && -f "$WHEEL_FF" ]]; then
    cp -f "$WHEEL_FF" "$TOOLS/ffmpeg"; chmod +x "$TOOLS/ffmpeg"
    ok "ffmpeg -> $TOOLS/ffmpeg ($("$TOOLS/ffmpeg" -version | head -1 | cut -c1-60))"
  else
    die "could not obtain an FFmpeg binary"
  fi
fi

# ffprobe is not shipped by imageio-ffmpeg; `ffprobe-static` on npm has it.
if [[ ! -x "$TOOLS/ffprobe" ]]; then
  if command -v ffprobe >/dev/null 2>&1; then
    ok "system ffprobe: $(command -v ffprobe)"
  else
    TMPP="$(mktemp -d)"
    if (cd "$TMPP" && npm pack ffprobe-static >/dev/null 2>&1) \
       && tar -xzf "$TMPP"/ffprobe-static-*.tgz -C "$TMPP" 2>/dev/null; then
      SRC="$TMPP/package/bin/linux/x64/ffprobe"
      [[ -f "$SRC" ]] && cp -f "$SRC" "$TOOLS/ffprobe" && chmod +x "$TOOLS/ffprobe" \
        && ok "ffprobe -> $TOOLS/ffprobe"
    fi
    rm -rf "$TMPP"
    [[ -x "$TOOLS/ffprobe" ]] || warn "ffprobe unavailable - falling back to ffmpeg stderr probing"
  fi
else
  ok "ffprobe present"
fi

# ── 3. Fonts ────────────────────────────────────────────────────────────────
say "Fonts (this image ships none)"
if [[ -n "$(ls -A "$FONTS" 2>/dev/null || true)" && $FORCE -eq 0 ]]; then
  ok "$(ls "$FONTS" | wc -l) font files already in fonts/"
else
  "$PY" scripts/install_fonts.py || warn "font install incomplete"
fi

# ── 4. Chromium for Remotion ────────────────────────────────────────────────
say "Headless Chromium (Remotion renderer)"
if [[ -x "$TOOLS/chromium/chromium" && $FORCE -eq 0 ]]; then
  ok "$("$TOOLS/chromium/chromium" --version 2>/dev/null || echo chromium)"
else
  TMPC="$(mktemp -d)"
  if (cd "$TMPC" && npm pack @sparticuz/chromium >/dev/null 2>&1); then
    tar -xzf "$TMPC"/sparticuz-chromium-*.tgz -C "$TMPC" 2>/dev/null || true
    "$PY" - "$TMPC/package/bin" "$TOOLS/chromium" <<'PY'
import sys, pathlib
try:
    import brotli as _b
    decompress = _b.decompress
except ImportError:  # brotlicffi fallback
    import brotlicffi as _b
    decompress = _b.decompress
src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
(dst / "lib").mkdir(exist_ok=True)
data = decompress((src / "chromium.br").read_bytes())
exe = dst / "chromium"
exe.write_bytes(data)
exe.chmod(0o755)
print(f"  chromium binary: {len(data)/2**20:.0f} MiB")
# shared libs the binary needs but this image lacks (NSS/NSPR/expat)
import tarfile, io
tar = tarfile.open(fileobj=io.BytesIO(decompress((src / "al2023.tar.br").read_bytes())))
tar.extractall(dst)
print("  bundled libs:", ", ".join(sorted(p.name for p in (dst/'lib').iterdir())))
PY
  fi
  rm -rf "$TMPC"
  if [[ -x "$TOOLS/chromium/chromium" ]] && LD_LIBRARY_PATH="$TOOLS/chromium/lib" "$TOOLS/chromium/chromium" --version >/dev/null 2>&1; then
    ok "$(LD_LIBRARY_PATH="$TOOLS/chromium/lib" "$TOOLS/chromium/chromium" --version)"
  else
    warn "Chromium not usable - Remotion rendering will be unavailable, FFmpeg path still works"
  fi
fi

# ── 5. Remotion studio ──────────────────────────────────────────────────────
say "Remotion (React-based motion graphics)"
if [[ -d "$ROOT/remotion-studio/node_modules" && $FORCE -eq 0 ]]; then
  ok "node modules already installed"
else
  (cd "$ROOT/remotion-studio" && npm install --no-audit --no-fund --loglevel=error) \
    && ok "installed $(node -p "require('./remotion-studio/package.json').dependencies.remotion" 2>/dev/null || echo remotion)" \
    || warn "npm install failed in remotion-studio"
fi

# ── 6. environment file ─────────────────────────────────────────────────────
cat > "$TOOLS/env.sh" <<EOF
# source me:  source .tools/env.sh
export YTV_TOOLS_DIR="$TOOLS"
export YTV_FONTS_DIR="$FONTS"
export PATH="$TOOLS:$VENV/bin:\$PATH"
export YTV_FFMPEG="$TOOLS/ffmpeg"
[[ -x "$TOOLS/ffprobe" ]] && export YTV_FFPROBE="$TOOLS/ffprobe"
[[ -x "$TOOLS/chromium/chromium" ]] && export YTV_CHROME="$TOOLS/chromium/chromium"
[[ -d "$TOOLS/chromium/lib" ]] && export LD_LIBRARY_PATH="$TOOLS/chromium/lib:\${LD_LIBRARY_PATH:-}"
EOF
ok "wrote .tools/env.sh"

say "Environment check"
"$VENV/bin/python" -m ytstudio doctor || true

cat <<'EOF'

────────────────────────────────────────────────────────────────────────────
 Next steps
   source .tools/env.sh
   .venv/bin/python -m ytstudio doctor          # full capability report
   .venv/bin/python -m ytstudio sample          # render the demo video
   .venv/bin/python -m ytstudio init "My Topic" # scaffold a new project
────────────────────────────────────────────────────────────────────────────
EOF
