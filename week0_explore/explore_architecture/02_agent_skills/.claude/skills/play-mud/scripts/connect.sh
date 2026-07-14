#!/usr/bin/env bash
# Start (or reuse) the persistent MUD connection.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_DIR="${MUD_SESSION_DIR:-/tmp/tbamud-session}"

if [ -S "$SESSION_DIR/ctl.sock" ] && [ -f "$SESSION_DIR/daemon.pid" ] && kill -0 "$(cat "$SESSION_DIR/daemon.pid")" 2>/dev/null; then
  echo "[connect] already connected, draining any unread output:"
  echo "---"
  python3 "$SCRIPT_DIR/mud_daemon.py" client "$SESSION_DIR" ""
  exit 0
fi

rm -rf "$SESSION_DIR"
mkdir -p "$SESSION_DIR"

nohup python3 "$SCRIPT_DIR/mud_daemon.py" serve "$SESSION_DIR" > "$SESSION_DIR/daemon.err" 2>&1 &
disown

echo "[connect] starting daemon and logging in as dummy..."
for i in $(seq 1 250); do
  [ -S "$SESSION_DIR/ctl.sock" ] && break
  sleep 0.1
done

if [ ! -S "$SESSION_DIR/ctl.sock" ]; then
  echo "[connect] FAILED: daemon did not come up within 25s. Check $SESSION_DIR/daemon.err and $SESSION_DIR/out.log" >&2
  exit 1
fi

status=$(python3 -c "import json; print(json.load(open('$SESSION_DIR/state.json')).get('status','?'))" 2>/dev/null || echo "?")
echo "[connect] login status: $status"
if [ "$status" = "login_uncertain" ]; then
  echo "[connect] WARNING: could not confirm the in-game prompt appeared. Read the transcript below carefully before sending game commands -- consider running status.sh or inspecting $SESSION_DIR/out.log." >&2
fi
echo "---"
python3 "$SCRIPT_DIR/mud_daemon.py" client "$SESSION_DIR" ""
