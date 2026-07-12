#!/usr/bin/env bash
# Cleanly log the character out (quit -> account menu -> exit) and stop
# the daemon. tbaMUD's "quit" command only drops you to an account menu
# (0-5 choices); this script also sends "0" to actually close the
# connection, so the character doesn't linger logged in.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_DIR="${MUD_SESSION_DIR:-/tmp/tbamud-session}"

if [ ! -S "$SESSION_DIR/ctl.sock" ] || [ ! -f "$SESSION_DIR/daemon.pid" ] || ! kill -0 "$(cat "$SESSION_DIR/daemon.pid")" 2>/dev/null; then
  echo "[disconnect] not connected."
  exit 0
fi

python3 "$SCRIPT_DIR/mud_daemon.py" client "$SESSION_DIR" "__LOGOUT__"

for i in $(seq 1 30); do
  [ -f "$SESSION_DIR/daemon.pid" ] || break
  sleep 0.2
done

if [ -f "$SESSION_DIR/daemon.pid" ]; then
  pid=$(cat "$SESSION_DIR/daemon.pid" 2>/dev/null || echo "")
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
fi

echo
echo "[disconnect] done."
