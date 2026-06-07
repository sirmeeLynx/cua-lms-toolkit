#!/bin/bash
# Extract key frames from the video at scene/slide changes, named by timestamp.
# Usage: ./keyframes.sh <work_dir> [scene_threshold]

set -euo pipefail

WORK_DIR="${1:-/tmp/lms-video}"
THRESHOLD="${2:-0.30}"
VIDEO="$WORK_DIR/video.mp4"
FRAMES="$WORK_DIR/frames"
SCENES="$WORK_DIR/scenes.txt"

[ -f "$VIDEO" ] || { echo "Missing $VIDEO (run download.sh first)"; exit 1; }
mkdir -p "$FRAMES"
rm -f "$FRAMES"/*.png

echo "Detecting scene changes (threshold $THRESHOLD)..."
ffmpeg -loglevel error -i "$VIDEO" \
  -vf "select='gt(scene,$THRESHOLD)',metadata=print:file=$SCENES" \
  -an -fps_mode vfr -f null - 2>/dev/null

# Collect scene timestamps, plus regular interval samples every INTERVAL seconds.
INTERVAL="${3:-20}"
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO")
DUR_INT=${DURATION%.*}

SCENE_TIMES=$(grep -oE 'pts_time:[0-9.]+' "$SCENES" 2>/dev/null | cut -d: -f2 || true)
INTERVAL_TIMES=$(seq 2 "$INTERVAL" "$DUR_INT")
TIMES=$(printf "%s\n%s" "$INTERVAL_TIMES" "$SCENE_TIMES" | sort -n -u)

echo "Extracting frames..."
count=0
for t in $TIMES; do
  ti=${t%.*}                       # integer seconds
  mm=$(printf "%02d" $((ti / 60)))
  ss=$(printf "%02d" $((ti % 60)))
  out="$FRAMES/${mm}${ss}.png"
  [ -f "$out" ] && continue
  ffmpeg -loglevel error -ss "$t" -i "$VIDEO" -frames:v 1 "$out" 2>/dev/null || true
  count=$((count + 1))
done

echo "Extracted $count key frames into $FRAMES"
ls "$FRAMES" | sort | head -40
