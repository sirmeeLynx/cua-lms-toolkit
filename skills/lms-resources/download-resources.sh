#!/bin/bash
# Download course File resources (datasets, notebooks, slides, templates).
# Enumerates resources via the API, then downloads each with curl + session cookies.
#
# Usage: ./download-resources.sh [course_id] [out_root] [filter_regex]
#   filter_regex (optional): only download files whose "module + title" matches,
#   e.g. "FoodHub"  |  "Practice Exercise"  |  "Week 1"

set -uo pipefail

COURSE_ID="${1:-141734}"
OUT_ROOT="${2:-$HOME/lms/foundations-of-ai/resources}"
FILTER="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="/tmp/gl-resources.json"

echo "Enumerating resources..."
node "$HERE/enumerate-resources.js" "$COURSE_ID" "$MANIFEST"

COOKIE=$(cat /tmp/gl_cookie.txt)
count=$(node -e "console.log(require('$MANIFEST').length)")

downloaded=0
skipped=0
for i in $(seq 0 $((count - 1))); do
  MODULE=$(node -e "console.log(require('$MANIFEST')[$i].module)")
  FILENAME=$(node -e "console.log(require('$MANIFEST')[$i].filename)")
  URL=$(node -e "console.log(require('$MANIFEST')[$i].url)")

  if [ -n "$FILTER" ] && ! echo "$MODULE $FILENAME" | grep -qiE "$FILTER"; then
    skipped=$((skipped + 1)); continue
  fi

  SAFE_MODULE=$(echo "$MODULE" | tr '/:*?"<>|' '_')
  SAFE_FILE=$(echo "$FILENAME" | tr '/:*?"<>|' '_')
  DIR="$OUT_ROOT/$SAFE_MODULE"
  mkdir -p "$DIR"
  DEST="$DIR/$SAFE_FILE"

  if [ -f "$DEST" ]; then echo "skip (exists): $SAFE_FILE"; skipped=$((skipped + 1)); continue; fi

  code=$(curl -s -L -H "Cookie: $COOKIE" -H "Referer: https://olympus.mygreatlearning.com/" "$URL" -o "$DEST" -w "%{http_code}")
  if [ "$code" = "200" ]; then
    echo "saved: $SAFE_MODULE / $SAFE_FILE"
    downloaded=$((downloaded + 1))
  else
    echo "FAILED ($code): $SAFE_FILE"; rm -f "$DEST"
  fi
done

echo ""
echo "Done. downloaded: $downloaded | skipped: $skipped | output: $OUT_ROOT"
