#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v edge-tts >/dev/null 2>&1; then
  echo "edge-tts not found, installing (pip install edge-tts)..."
  pip install edge-tts
fi

mkdir -p public/assets

edge-tts \
  -f scripts/narration.txt \
  -v en-US-AndrewNeural \
  --rate=-8% \
  --write-media public/assets/narration.mp3

echo "Wrote public/assets/narration.mp3"
