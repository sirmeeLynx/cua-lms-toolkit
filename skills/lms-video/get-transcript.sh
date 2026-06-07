#!/bin/bash
# Fast English-transcript-only extraction for an LMS video page (no video download).
# Resolves the master playlist, finds the English subtitle track, and writes
# transcript.vtt into <out_dir>.
#
# Usage: ./get-transcript.sh <page_url> <out_dir> [cdp_port]

set -uo pipefail

PAGE_URL="$1"
OUT_DIR="$2"
CDP_PORT="${3:-9222}"
HERE="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$OUT_DIR"

node "$HERE/resolve-master.js" "$CDP_PORT" "$OUT_DIR" "$PAGE_URL" >/dev/null 2>&1 || { echo "resolve failed"; exit 1; }

MASTER=$(node -e "console.log(require('$OUT_DIR/descriptor.json').master)")
COOKIE=$(cat "$OUT_DIR/cookie_header.txt")
HDR="Cookie: $COOKIE"$'\r\n'"Referer: https://olympus.mygreatlearning.com/"$'\r\n'

# Find the English subtitle playlist URI from the master.
EN_REL=$(curl -s -H "Cookie: $COOKIE" -H "Referer: https://olympus.mygreatlearning.com/" "$MASTER" \
  | grep -i 'TYPE=SUBTITLES' | grep -i 'LANGUAGE="en"' \
  | sed -E 's/.*URI="([^"]+)".*/\1/')

if [ -z "$EN_REL" ]; then
  echo "no English subtitle track found"
  exit 2
fi

BASE=$(dirname "$MASTER")
EN_URL="$BASE/$EN_REL"

ffmpeg -nostdin -y -loglevel error -headers "$HDR" -i "$EN_URL" "$OUT_DIR/transcript.vtt" \
  && echo "OK $(wc -l < "$OUT_DIR/transcript.vtt") lines" \
  || { echo "ffmpeg failed"; exit 3; }
