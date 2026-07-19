import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml, type YamlMap } from "../yaml.ts";

export type TaskSettings = YamlMap;

export class Config {
  static readonly DEFAULT_DIR = join(homedir(), ".boukensha");
  static readonly PROMPTS_DIR = fileURLToPath(new URL("../../prompts", import.meta.url));

  readonly dir: string;
  readonly settings: YamlMap;

  constructor() {
    const configured = process.env.BOUKENSHA_DIR;
    this.dir = configured ? (isAbsolute(configured) ? configured : resolve(configured)) : Config.DEFAULT_DIR;
    this.loadEnv();
    this.settings = this.loadSettings();
  }

  tasks(): Record<string, TaskSettings>;
  tasks(name: string): TaskSettings | undefined;
  tasks(name?: string): Record<string, TaskSettings> | TaskSettings | undefined {
    const all = (this.dig("tasks") as Record<string, TaskSettings> | undefined) ?? {};
    return name === undefined ? all : all[name];
  }

  get userPromptsDir(): string { return join(this.dir, "prompts"); }
  get mudHost(): string { return (this.dig("mud", "host") as string | undefined) ?? "localhost"; }
  get mudPort(): number { return (this.dig("mud", "port") as number | undefined) ?? 4000; }
  get mudUsername(): string | undefined { return this.dig("mud", "username") as string | undefined; }
  get mudPassword(): string | undefined { return this.dig("mud", "password") as string | undefined; }

  dig(...keys: string[]): unknown {
    return keys.reduce<unknown>((node, key) => {
      return node && typeof node === "object" ? (node as YamlMap)[key] : undefined;
    }, this.settings);
  }

  toString(): string { return `#<Boukensha::Config dir=${this.dir} tasks=${Object.keys(this.tasks()).join(",")}>`; }

  private loadEnv(): void {
    const path = join(this.dir, ".env");
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }

  private loadSettings(): YamlMap {
    const path = join(this.dir, "settings.yaml");
    return existsSync(path) ? parseYaml(readFileSync(path, "utf8")) : {};
  }
}
