#!/usr/bin/env bash
# Report whether the daemon is connected/logged in, plus a tail of the
# raw transcript, without sending anything to the MUD.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_DIR="${MUD_SESSION_DIR:-/tmp/tbamud-session}"

if [ ! -S "$SESSION_DIR/ctl.sock" ] || [ ! -f "$SESSION_DIR/daemon.pid" ] || ! kill -0 "$(cat "$SESSION_DIR/daemon.pid")" 2>/dev/null; then
  echo "not connected"
  exit 0
fi

python3 "$SCRIPT_DIR/mud_daemon.py" client "$SESSION_DIR" "__STATUS__"
echo
echo "--- last 40 lines of transcript ($SESSION_DIR/out.log) ---"
tail -n 40 "$SESSION_DIR/out.log" 2>/dev/null || true
