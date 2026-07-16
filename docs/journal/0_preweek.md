# Technical Journaling Format

My goal was to figure out if steering mechanisms like AGENTS.md/CLAUDE.md or skills can be utilized for a specific task.

## Technical Goal

As I am fairly familiar with AI steering techniques I had already envisioned what might happen if we use CLAUDE.md or skills to play the MUD game.
Goal was to put these to the test and verify my suspicions.

## Technical Uncertainty

- I wasn't sure if CLAUDE.md would be able to play the MUD game. I also thought of this file as a technical debt notepad where I tell the agent how to handle any unforseen scenarios.
- Skills seemed like a good fit for the task as they are a way to describe predictable actions that can be used to play the MUD game.

## Technical Hypotheses

- I don't think that without a deterministic interface like a game engine or a web interface we can make a reliable agent that can play the MUD game. Also updating the state of the game and world exploration mechanics need to be taken into account.

## Technical Observerations

The agent struggled to reliably log in to the MUD, resulting in poor efforts such as reading unrelated files and repeatedly issuing movement commands with delays. Attempts to automate gameplay by generating shell scripts did not meaningfully improve progress, and the agent failed to update in-game state files with its actions or discoveries. Even switching to better model didn't resolve these core reliability problems.

## Technical Conclusions

- The agent using only a coding harness could not reliably log in to the MUD, leading to off-track attempts like reading unrelated files and repeatedly trying directions with various wait times.
- Attempts to automate exploration by generating scripts (e.g., `explore_south.sh`, `explore_general_store.sh`) did not yield effective progress.
- The agent neglected to update in-game state files (`data/player.md`, `data/world.md`) with actions and observations, missing out on tracking its own progress.
- Switching to a more advanced model did not resolve the core reliability or context issues; errors and unproductive “work” persisted.
- Overall, these results suggest that coding harnesses alone are insufficient for robust, interactive gameplay in the MUD environment without a more deterministic, reusable connection or control interface.

## Key Takeaway

Coding harnesses alone are not a good fit for unpredictable environments like the MUD.
We need something that more or less knows where it is in a given moment and can place itself in the environment.
