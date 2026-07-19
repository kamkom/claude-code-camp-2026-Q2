import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Config, Player } from "../lib/boukensha.ts";

test("loads task, MUD, env, and overridden prompt settings", () => {
  const dir = join(tmpdir(), `boukensha-config-${process.pid}-${Date.now()}`);
  mkdirSync(join(dir, "prompts", "player"), { recursive: true });
  writeFileSync(join(dir, "settings.yaml"), `
tasks:
  player:
    provider: anthropic # comment
    model: claude-haiku-4-5
    prompt_override:
      system: true
mud:
  host: mud.example
  port: 4444
  username: hero
  password: swordfish
`);
  writeFileSync(join(dir, ".env"), "BOUKENSHA_TEST_KEY=secret\n");
  writeFileSync(join(dir, "prompts", "player", "system.md"), "  custom prompt  \n");

  const previous = process.env.BOUKENSHA_DIR;
  process.env.BOUKENSHA_DIR = dir;
  try {
    const config = new Config();
    const player = config.tasks("player");
    assert.equal(Player.provider(player), "anthropic");
    assert.equal(Player.model(player), "claude-haiku-4-5");
    assert.equal(Player.promptOverride(player), true);
    assert.equal(Player.systemPrompt(player, { userPromptsDir: config.userPromptsDir }), "custom prompt");
    assert.equal(config.mudHost, "mud.example");
    assert.equal(config.mudPort, 4444);
    assert.equal(config.mudUsername, "hero");
    assert.equal(config.mudPassword, "swordfish");
    assert.equal(process.env.BOUKENSHA_TEST_KEY, "secret");
  } finally {
    if (previous === undefined) delete process.env.BOUKENSHA_DIR;
    else process.env.BOUKENSHA_DIR = previous;
  }
});

test("falls back to defaults and the shipped prompt", () => {
  const dir = join(tmpdir(), `boukensha-empty-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const previous = process.env.BOUKENSHA_DIR;
  process.env.BOUKENSHA_DIR = dir;
  try {
    const config = new Config();
    assert.deepEqual(config.tasks(), {});
    assert.equal(config.mudHost, "localhost");
    assert.equal(config.mudPort, 4000);
    assert.match(Player.systemPrompt({}, { defaultPromptsDir: Config.PROMPTS_DIR })!, /^You are a MUD player assistant/);
  } finally {
    if (previous === undefined) delete process.env.BOUKENSHA_DIR;
    else process.env.BOUKENSHA_DIR = previous;
  }
});
