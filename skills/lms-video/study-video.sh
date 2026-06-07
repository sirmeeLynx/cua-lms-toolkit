#!/bin/bash
# Orchestrate the full LMS video study pipeline:
#   resolve master URL -> download video + transcript -> extract key frames
#
# Run while the target video is playing in the CUA Edge browser, OR pass a page
# URL to navigate to first.
# Usage: ./study-video.sh [cdp_port] [work_dir] [scene_threshold] [interval] [page_url]

set -euo pipefail

CDP_PORT="${1:-9222}"
WORK_DIR="${2:-/tmp/lms-video}"
THRESHOLD="${3:-0.20}"
INTERVAL="${4:-20}"
PAGE_URL="${5:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "== 1/3 Resolving master playlist =="
node "$HERE/resolve-master.js" "$CDP_PORT" "$WORK_DIR" "$PAGE_URL"

echo "== 2/3 Downloading video + transcript =="
"$HERE/download.sh" "$WORK_DIR"

echo "== 3/3 Extracting key frames =="
"$HERE/keyframes.sh" "$WORK_DIR" "$THRESHOLD" "$INTERVAL"

echo ""
echo "Study assets ready in: $WORK_DIR"
echo "  video.mp4       - full lecture video"
echo "  transcript.vtt  - timestamped transcript"
echo "  frames/         - key frames named by mmss timestamp"
