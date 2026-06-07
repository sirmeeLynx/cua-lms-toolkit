#!/bin/bash
# Download all video lectures in a Great Learning course.
#
# Sequentially resolves each video page's master URL (navigating the CUA browser),
# then spawns background ffmpeg downloads (video + transcript only) with a
# concurrency cap. Frames are NOT extracted here -- use the lms-video skill
# on-demand when studying a specific video.
#
# Usage: ./download-course.sh [course_id] [out_root] [max_parallel] [cdp_port]

set -uo pipefail

COURSE_ID="${1:-}"
OUT_ROOT="${2:-/tmp/lms-course}"
MAX_PARALLEL="${3:-3}"
CDP_PORT="${4:-9222}"
HERE="$(cd "$(dirname "$0")" && pwd)"
VIDEO_SKILL="$(cd "$HERE/../lms-video" && pwd)"
MANIFEST="$OUT_ROOT/items.json"

mkdir -p "$OUT_ROOT"

echo "== Enumerating course videos =="
node "$HERE/list-items.js" "$CDP_PORT" "$COURSE_ID" "$MANIFEST"

COURSE_ID=$(node -e "console.log(require('$MANIFEST').courseId)")
PB_ID=$(node -e "console.log(require('$MANIFEST').pbId)")

# Emit "moduleId<TAB>itemId<TAB>title" for likely-video items.
ITEMS=$(node -e "
const m=require('$MANIFEST');
m.items.filter(i=>i.likelyVideo).forEach(i=>console.log([i.moduleId,i.itemId,i.title].join('\t')));
")

PIDS=()
throttle() {
  while :; do
    local alive=()
    for pid in "${PIDS[@]:-}"; do
      [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && alive+=("$pid")
    done
    PIDS=("${alive[@]:-}")
    [ "${#PIDS[@]}" -lt "$MAX_PARALLEL" ] && break
    sleep 1
  done
}

total=0
downloaded=0
skipped=0
LIMIT="${LIMIT:-0}"   # 0 = no limit; otherwise cap number of videos processed

while IFS=$'\t' read -r MODULE_ID ITEM_ID TITLE; do
  [ -z "$ITEM_ID" ] && continue
  if [ "$LIMIT" -gt 0 ] && [ "$downloaded" -ge "$LIMIT" ]; then break; fi
  total=$((total + 1))
  WORK="$OUT_ROOT/$MODULE_ID/$ITEM_ID"

  if [ -f "$WORK/video.mp4" ]; then
    echo "[$ITEM_ID] already downloaded - skip"
    skipped=$((skipped + 1))
    continue
  fi

  ITEM_URL="https://olympus.mygreatlearning.com/courses/$COURSE_ID/modules/items/$ITEM_ID?pb_id=$PB_ID"
  echo "[$ITEM_ID] resolving: $TITLE"

  if ! node "$VIDEO_SKILL/resolve-master.js" "$CDP_PORT" "$WORK" "$ITEM_URL" >/dev/null 2>&1; then
    echo "[$ITEM_ID] no video on page - skip"
    skipped=$((skipped + 1))
    continue
  fi

  throttle
  (
    "$VIDEO_SKILL/download.sh" "$WORK" >/dev/null 2>&1 \
      && echo "[$ITEM_ID] done: $TITLE" \
      || echo "[$ITEM_ID] FAILED: $TITLE"
  ) </dev/null &
  PIDS+=("$!")
  downloaded=$((downloaded + 1))
done <<< "$ITEMS"

echo "Waiting for downloads to finish..."
wait

echo ""
echo "Course download complete."
echo "  candidates: $total"
echo "  started:    $downloaded"
echo "  skipped:    $skipped"
echo "  output:     $OUT_ROOT"
