#!/bin/bash
# Stop the Edge session for this VS Code instance.

VSCODE_PID=$(ps -o ppid= -p $$ | tr -d ' ')
SESSION_DIR=".vscode/$VSCODE_PID"
PID_FILE="$SESSION_DIR/.edge-pid"

[ -f "$PID_FILE" ] || { echo "No Edge session found."; exit 1; }

EDGE_PID=$(cat "$PID_FILE")

kill "$EDGE_PID" 2>/dev/null
while kill -0 "$EDGE_PID" 2>/dev/null; do sleep 0.25; done

echo "Edge stopped (PID: $EDGE_PID)"
rm -rf "$SESSION_DIR"