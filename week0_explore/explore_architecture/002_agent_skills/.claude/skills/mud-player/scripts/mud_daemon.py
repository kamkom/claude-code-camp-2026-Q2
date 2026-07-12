#!/usr/bin/env python3
"""
Persistent connection manager for the tbaMUD server at localhost:4000.

Two modes, selected by argv[1]:

  serve <session_dir>          Run the long-lived daemon: open one TCP
                                connection to the MUD, log in, then listen
                                on a Unix domain socket for short-lived
                                "client" requests (one command in, the new
                                game text out).

  client <session_dir> <cmd>   Send a single request to a running daemon's
                                control socket and print the response.
                                <cmd> is one of:
                                  ""            drain any new output, send nothing
                                  "__STATUS__"  report daemon/login status as JSON
                                  "__LOGOUT__"  run the quit -> account-menu -> "0"
                                                sequence and shut the daemon down
                                  anything else forwarded to the MUD verbatim

Why a daemon at all: tbaMUD (like CircleMUD) treats every new TCP connection
as a fresh login. Reconnecting for every single game command would be slow,
would replay the login handshake constantly, and spams other players with
enter/leave messages. Holding one socket open across many agent turns avoids
all of that -- the shell scripts (connect.sh/send.sh/status.sh/disconnect.sh)
are just thin clients that talk to this daemon over a Unix socket.
"""
import json
import os
import re
import socket
import sys
import threading
import time

MUD_HOST = "localhost"
MUD_PORT = 4000
USERNAME = "dummy"
PASSWORD = "helloworld"

# Tail-of-buffer patterns used to drive the login state machine. These were
# captured by hand-probing the live server (see docs/explore_architectures.md
# for the write-up) -- tbaMUD's flow is not a plain "answer these 3 prompts",
# it can drop you into an account menu that requires an extra "1" to actually
# enter the game.
READY_RE = re.compile(r"\d+H\s+\S+\s+\d+V.*>\s*$")  # in-game status prompt, e.g. "24H 100M 9V (news) (motd) > "
MENU_RE = re.compile(r"Make your choice:\s*$")
RETURN_RE = re.compile(r"PRESS RETURN", re.IGNORECASE)
YN_RE = re.compile(r"\(y/n\)", re.IGNORECASE)

ANSI_RE = re.compile(rb"\x1b\[[0-9;]*[a-zA-Z]")


def clean(data: bytes) -> str:
    """Strip ANSI color codes and stray telnet/control bytes so the agent
    sees plain readable text instead of escape-code soup."""
    data = ANSI_RE.sub(b"", data)
    text = data.decode("utf-8", errors="ignore")
    return "".join(c for c in text if c in "\r\n\t" or 32 <= ord(c) < 127 or ord(c) > 127)


class MudSession:
    def __init__(self, session_dir):
        self.session_dir = session_dir
        self.log_path = os.path.join(session_dir, "out.log")
        self.sock = socket.create_connection((MUD_HOST, MUD_PORT), timeout=10)
        self.sock.settimeout(0.3)
        self.buffer = ""
        self.cursor = 0
        self.lock = threading.Lock()
        self.connected = True
        self.status = "connecting"

    # ---- reader thread -------------------------------------------------
    def reader_loop(self):
        while True:
            try:
                chunk = self.sock.recv(4096)
            except socket.timeout:
                continue
            except OSError:
                break
            if not chunk:
                break
            text = clean(chunk)
            with self.lock:
                self.buffer += text
            with open(self.log_path, "a") as f:
                f.write(text)
        with self.lock:
            self.connected = False
            self.buffer += "\n[daemon] MUD connection closed.\n"
        self._write_state()

    def _write_state(self):
        state = {
            "status": self.status,
            "connected": self.connected,
            "pid": os.getpid(),
            "buffer_len": len(self.buffer),
            "cursor": self.cursor,
        }
        with open(os.path.join(self.session_dir, "state.json"), "w") as f:
            json.dump(state, f)

    # ---- helpers used by both login and request handling ---------------
    def tail(self, n=500):
        with self.lock:
            return self.buffer[-n:]

    def send_line(self, text):
        self.sock.sendall((text + "\r\n").encode())

    def wait_for(self, pattern, timeout):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if pattern.search(self.tail()):
                return True
            time.sleep(0.1)
        return False

    # ---- login state machine -------------------------------------------
    def login(self):
        self.status = "logging_in"
        self._write_state()
        self.wait_for(re.compile(r"name.*\?\s*$", re.IGNORECASE), 5)
        self.send_line(USERNAME)
        self.wait_for(re.compile(r"assword:\s*$"), 4)
        self.send_line(PASSWORD)

        deadline = time.time() + 10
        while time.time() < deadline:
            tail = self.tail()
            if READY_RE.search(tail):
                self.status = "ready"
                self._write_state()
                return
            if MENU_RE.search(tail):
                self.send_line("1")
            elif RETURN_RE.search(tail):
                self.send_line("")
            elif YN_RE.search(tail):
                self.send_line("n")
            time.sleep(0.3)
        # Gave up waiting for the in-game prompt. Don't crash -- leave the
        # daemon up so `status.sh` / the raw log can be inspected, and let
        # the agent decide whether to retry a command or disconnect.
        self.status = "login_uncertain"
        self._write_state()

    # ---- request handling ------------------------------------------------
    def handle(self, cmd):
        if cmd == "__STATUS__":
            with self.lock:
                return json.dumps(
                    {
                        "status": self.status,
                        "connected": self.connected,
                        "unread_bytes": len(self.buffer) - self.cursor,
                    }
                )

        if cmd == "__LOGOUT__":
            self.send_line("quit")
            self.wait_for(MENU_RE, 5)
            self.send_line("0")
            # wait for the reader thread to observe the socket close
            deadline = time.time() + 5
            while self.connected and time.time() < deadline:
                time.sleep(0.1)
            with self.lock:
                new_text = self.buffer[self.cursor :]
                self.cursor = len(self.buffer)
            return new_text

        with self.lock:
            start = self.cursor
        if cmd:
            self.send_line(cmd)

        # Wait for output to stop growing (the MUD has finished responding)
        # rather than sleeping a fixed amount -- commands vary a lot in how
        # much text they produce.
        quiet_window = 0.5
        max_wait = 6.0
        deadline = time.time() + max_wait
        last_len = start
        stable_since = time.time()
        while time.time() < deadline:
            with self.lock:
                cur_len = len(self.buffer)
            if cur_len != last_len:
                last_len = cur_len
                stable_since = time.time()
            elif cur_len > start and time.time() - stable_since > quiet_window:
                break
            time.sleep(0.1)

        with self.lock:
            new_text = self.buffer[start:]
            self.cursor = len(self.buffer)
        return new_text


def serve(session_dir):
    os.makedirs(session_dir, exist_ok=True)
    ctl_path = os.path.join(session_dir, "ctl.sock")
    if os.path.exists(ctl_path):
        os.remove(ctl_path)

    session = MudSession(session_dir)
    reader = threading.Thread(target=session.reader_loop, daemon=True)
    reader.start()
    session.login()

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(ctl_path)
    server.listen(4)
    server.settimeout(1.0)

    with open(os.path.join(session_dir, "daemon.pid"), "w") as f:
        f.write(str(os.getpid()))

    try:
        while True:
            if not session.connected and session.status != "shutting_down":
                break
            try:
                conn, _ = server.accept()
            except socket.timeout:
                continue
            try:
                conn.settimeout(2.0)
                raw = b""
                try:
                    raw = conn.recv(65536)
                except socket.timeout:
                    pass
                cmd = raw.decode(errors="ignore").rstrip("\r\n")
                if cmd == "__LOGOUT__":
                    session.status = "shutting_down"
                response = session.handle(cmd)
                conn.sendall(response.encode())
            finally:
                conn.close()
            if cmd == "__LOGOUT__":
                break
    finally:
        try:
            server.close()
        finally:
            for p in (ctl_path, os.path.join(session_dir, "daemon.pid")):
                if os.path.exists(p):
                    os.remove(p)
            session._write_state()


def client(session_dir, cmd):
    ctl_path = os.path.join(session_dir, "ctl.sock")
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect(ctl_path)
    sock.sendall(cmd.encode())
    sock.shutdown(socket.SHUT_WR)
    chunks = []
    sock.settimeout(8)
    while True:
        try:
            chunk = sock.recv(65536)
        except socket.timeout:
            break
        if not chunk:
            break
        chunks.append(chunk)
    sys.stdout.write(b"".join(chunks).decode(errors="ignore"))


def main():
    if len(sys.argv) < 3:
        print("usage: mud_daemon.py serve <session_dir> | client <session_dir> <cmd>", file=sys.stderr)
        sys.exit(2)
    mode, session_dir = sys.argv[1], sys.argv[2]
    if mode == "serve":
        serve(session_dir)
    elif mode == "client":
        cmd = sys.argv[3] if len(sys.argv) > 3 else ""
        client(session_dir, cmd)
    else:
        print(f"unknown mode: {mode}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
