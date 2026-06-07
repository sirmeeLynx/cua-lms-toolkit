#!/bin/bash
# Download the LMS video and its VTT transcript using the captured descriptor.
# Usage: ./download.sh <work_dir>   (default: /tmp/lms-video)

set -euo pipefail

WORK_DIR="${1:-/tmp/lms-video}"
DESC="$WORK_DIR/descriptor.json"

[ -f "$DESC" ] || { echo "Missing $DESC (run extract.js first)"; exit 1; }

MASTER=$(node -e "console.log(require('$DESC').master)")
COOKIE=$(cat "$WORK_DIR/cookie_header.txt")

HDR="Cookie: $COOKIE"$'\r\n'"Referer: https://olympus.mygreatlearning.com/"$'\r\n'"User-Agent: Mozilla/5.0"$'\r\n'

echo "Downloading video..."
ffmpeg -nostdin -y -loglevel error \
  -headers "$HDR" \
  -i "$MASTER" \
  -map 0:v:0 -map 0:a:0 -c copy \
  "$WORK_DIR/video.mp4"

echo "Extracting transcript (VTT)..."
# Select the English subtitle track explicitly (videos may list multiple
# languages; -map 0:s:0 would grab whichever is first, e.g. Portuguese).
ffmpeg -nostdin -y -loglevel error \
  -headers "$HDR" \
  -i "$MASTER" \
  -map 0:s:m:language:en \
  "$WORK_DIR/transcript.vtt" \
  || ffmpeg -nostdin -y -loglevel error -headers "$HDR" -i "$MASTER" -map 0:s:0 "$WORK_DIR/transcript.vtt" \
  || echo "WARNING: subtitle extraction failed (no captions?)"

echo "Done:"
ls -la "$WORK_DIR/video.mp4" "$WORK_DIR/transcript.vtt" 2>/dev/null
