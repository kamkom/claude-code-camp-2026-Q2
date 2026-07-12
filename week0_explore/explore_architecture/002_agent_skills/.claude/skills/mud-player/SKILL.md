---
name: mud-player
description: Play the tbaMUD (CircleMUD-family) game running at localhost:4000 as the character "dummy" -- connect, look around, move, fight, talk, manage inventory, or pursue any goal the user gives you inside the MUD. Use this skill whenever the user asks you to play the MUD, explore the game world, log into the MUD, run a MUD command, or otherwise interact with the multi-user dungeon at localhost:4000, even if they don't spell out every step. Do NOT hand-roll `nc localhost 4000` or raw socket code yourself for this -- always drive the game through this skill's connect.sh/send.sh/status.sh/disconnect.sh scripts, which already handle the login handshake and keep one persistent connection open across turns.
---

# Playing the MUD

You are acting as a player inside tbaMUD, a text-based multiplayer game (a
CircleMUD/DikuMUD descendant) running at `localhost:4000`. The user will
give you a goal -- explore, find an item, level up, complete a quest,
whatever -- and you drive the character toward it turn by turn, reading
each room description and deciding what to do next, the same way a human
player would.

## Why you don't talk to the socket yourself

A raw `nc localhost 4000` session works for a human typing interactively,
but it's a poor fit for you to drive directly: the login sequence has
several conditional steps (see below) that are easy to get wrong, MUD
output arrives in unpredictable bursts so you can't just "sleep 2 and
hope", and reconnecting for every single command would replay the login
every time and spam other players with join/leave messages. All of that
is handled once, deterministically, in `scripts/mud_daemon.py`. Your job
is to call the four wrapper scripts below and reason about the *game*,
not the *connection*.

## The four commands

All scripts live in `scripts/` next to this file and are run with Bash.
They all default to a shared session at `/tmp/tbamud-session`; you don't
need to manage that path yourself.

- **`scripts/connect.sh`** -- Starts the persistent connection if one
  isn't already running (spawns a background daemon that logs in as
  `dummy`/`helloworld`), or, if already connected, just prints anything
  new that arrived since you last looked. Run this once at the start of
  a session. It prints the full login transcript ending in the current
  room description -- read it, it's your starting point.

- **`scripts/send.sh "<command>"`** -- Sends one game command (e.g.
  `look`, `north`, `kill rat`, `say hello`, `inventory`, `get sword`) and
  prints the new text the game produced in response. This is how you take
  every in-game action. One command per call -- don't chain multiple
  actions with `;` or `&&` inside the string, since the MUD processes
  them as separate lines anyway and you want to see the result of each
  before deciding the next.

- **`scripts/status.sh`** -- Reports whether the daemon is up and logged
  in, plus a tail of the raw transcript, without sending anything to the
  game. Use this if a `send.sh` call seems to have hung, timed out, or
  returned nothing, to see what state the connection is actually in.

- **`scripts/disconnect.sh`** -- Logs the character out properly and
  stops the daemon. Use this when the user's goal is done or they ask you
  to stop playing. Don't just leave the daemon running forever, and never
  try to end the session by sending `quit` through `send.sh` and calling
  it done -- tbaMUD's `quit` only drops you into an account menu (a
  `0`/`1`/... numbered choice), it doesn't close the connection by
  itself. `disconnect.sh` handles that whole sequence for you.

## Reading command output

Output is cleaned of ANSI color codes already, so what you see is plain
text. Room descriptions end with a status line like:

```
24H 100M 68V (news) (motd) >
```

That's hit points / mana / movement points, not a command prompt you need
to respond to -- it's just how tbaMUD ends every block of output. The
`[ Exits: ... ]` line tells you which directions you can move.

Occasionally a `send.sh` call will return an empty or partial-looking
result -- this can happen if the game took a moment to respond (e.g. a
long combat round) or if unrelated MUD activity (another player's tell,
a mob wandering through) interleaved with your command's output. If a
response looks incomplete or you're unsure what happened, run
`scripts/status.sh` to see the fuller transcript before acting further --
don't just retry the same command blindly, since some actions (attacks,
consuming an item) aren't safe to repeat by accident.

## Persisting what you learn

This MUD experiment is being compared against an earlier attempt
(`001_plain_agent`) that used a plain `CLAUDE.md` + raw `nc` and never
kept any memory between actions. To make this experiment a fair
comparison and so you (or a future you) can resume a goal without
re-exploring from scratch, keep two files up to date in `data/` at the
root of this experiment folder, following the same convention as
`001_plain_agent/data/`:

- **`data/world.md`** -- What you've learned about the world: rooms
  you've visited (name, short description, exits), notable NPCs or items
  you've seen, and how areas connect to each other. Add to this as you
  explore; you don't need to re-describe a room you've already logged,
  just note new exits or changes.

- **`data/player.md`** -- The character's current state: level, hit
  points/mana/movement if notable, inventory, gold, current location,
  and progress toward whatever goal the user gave you (e.g. "heading
  south from the Bend in the Narrow Path toward the Dwarven Kingdom,
  looking for a weapon vendor").

Update these files after a meaningful chunk of progress (a few rooms, a
fight, picking up an item) rather than after every single command -- the
goal is a useful running summary, not a transcript dump (the raw
transcript already lives in `/tmp/tbamud-session/out.log` if you need to
double check something).

## Typical flow

1. `scripts/connect.sh` -- see where the character currently is.
2. Read `data/player.md` and `data/world.md` if they exist and have
   content, to recall prior progress instead of re-exploring blindly.
3. Loop: decide the next action based on the goal and the current room
   -> `scripts/send.sh "<command>"` -> read the result -> update your
   plan.
4. Periodically update `data/world.md` / `data/player.md`.
5. When the goal is reached or the user says to stop, update the memory
   files one last time and run `scripts/disconnect.sh`.
