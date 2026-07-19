import { Config, Player } from "../lib/boukensha.ts";

process.env.BOUKENSHA_DIR ??= new URL("../../../../.boukensha", import.meta.url).pathname;

const config = new Config();
const playerSettings = config.tasks("player");
const prompt = Player.systemPrompt(playerSettings, {
  userPromptsDir: config.userPromptsDir,
  defaultPromptsDir: Config.PROMPTS_DIR,
});

console.log("=== Boukensha Step 0: Configuration ===\n");
console.log(`Config dir:     ${config.dir}`);
console.log(`Tasks:          ${Object.keys(config.tasks()).join(", ")}\n`);
console.log("-- player task --");
console.log(`Provider:       ${Player.provider(playerSettings)}`);
console.log(`Model:          ${Player.model(playerSettings)}`);
console.log(`Prompt override?${Player.promptOverride(playerSettings)}`);
console.log(`System prompt:  ${prompt?.slice(0, 60)}...\n`);
console.log(`MUD host:       ${config.mudHost}:${config.mudPort}`);
console.log(`MUD user:       ${config.mudUsername}\n`);
console.log(`API key set?    ${process.env.ANTHROPIC_API_KEY !== undefined}\n`);
console.log(config.toString());
