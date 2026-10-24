#!/usr/bin/env bash
# Render the Remotion motion-graphics library (intro, title card, lower third,
# end screen, kinetic type) into projects/_assets/remotion/.
#
# Source: remotion-studio/src/Root.tsx
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -f .tools/env.sh ]] && source .tools/env.sh
OUT="${1:-projects/_assets/remotion}"
CHROME="${YTV_CHROME:-$PWD/.tools/chromium/chromium}"
mkdir -p "$OUT" remotion-studio/public/fonts

# Remotion loads fonts from public/fonts
cp -f fonts/*.ttf remotion-studio/public/fonts/ 2>/dev/null || true

if [[ ! -x "$CHROME" ]]; then
  echo "chromium not found at $CHROME — run ./bootstrap.sh" >&2
  exit 1
fi

cd remotion-studio
for comp in ChannelIntro TitleCard LowerThird EndScreen KineticTitle; do
  echo "→ $comp"
  npx remotion render src/index.ts "$comp" "../$OUT/${comp}.mp4" \
    --browser-executable="$CHROME" --concurrency=2 --log=warn
done
echo "done -> $OUT"
