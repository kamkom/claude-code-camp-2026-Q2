#!/usr/bin/env bash
# Send one game command to the running MUD session and print the new
# output it produces (waits for the game to finish responding).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_DIR="${MUD_SESSION_DIR:-/tmp/tbamud-session}"

if [ $# -lt 1 ]; then
  echo "usage: send.sh <command text>" >&2
  exit 2
fi

if [ ! -S "$SESSION_DIR/ctl.sock" ] || [ ! -f "$SESSION_DIR/daemon.pid" ] || ! kill -0 "$(cat "$SESSION_DIR/daemon.pid")" 2>/dev/null; then
  echo "[send] not connected. Run connect.sh first." >&2
  exit 1
fi

python3 "$SCRIPT_DIR/mud_daemon.py" client "$SESSION_DIR" "$*"
