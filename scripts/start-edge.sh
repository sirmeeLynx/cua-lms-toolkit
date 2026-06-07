#!/bin/bash
# Launch Edge with remote debugging and attach DevTools inside VS Code.
# Each VS Code instance gets its own directory: .vscode/{vscode-pid}/

EDGE_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
VSCODE_PID=$(ps -o ppid= -p $$ | tr -d ' ')
SESSION_DIR=".vscode/$VSCODE_PID"

mkdir -p "$SESSION_DIR"

# Find next available port starting from 9222
find_port() {
  local port=9222
  while lsof -i :$port >/dev/null 2>&1; do
    port=$((port + 1))
  done
  echo $port
}

# Check if already running
if [ -f "$SESSION_DIR/.edge-pid" ]; then
  EDGE_PID=$(cat "$SESSION_DIR/.edge-pid")
  if kill -0 "$EDGE_PID" 2>/dev/null; then
    echo "Edge already running (PID: $EDGE_PID, Port: $(cat "$SESSION_DIR/.edge-port"))"
    exit 0
  fi
fi

DEBUG_PORT=$(find_port)

echo "Starting Edge headless on port $DEBUG_PORT..."
"$EDGE_PATH" \
  --headless=new \
  --remote-debugging-port=$DEBUG_PORT \
  --hide-scrollbars \
  --mute-audio \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="/Users/sodudimu/Library/Application Support/Microsoft Edge" \
  --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.4022.52" \
  "about:blank" &
disown
EDGE_PID=$!

# Wait for Edge to be ready
for i in {1..10}; do
  curl -s "http://localhost:$DEBUG_PORT/json/version" >/dev/null 2>&1 && break
  sleep 1
done

echo "$EDGE_PID" > "$SESSION_DIR/.edge-pid"
echo "$DEBUG_PORT" > "$SESSION_DIR/.edge-port"

echo "Edge running (PID: $EDGE_PID, Port: $DEBUG_PORT)"
echo "→ Click 'Attach' on the target in Edge DevTools sidebar to open screencast."
