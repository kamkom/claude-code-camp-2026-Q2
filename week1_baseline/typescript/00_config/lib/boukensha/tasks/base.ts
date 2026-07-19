import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskSettings } from "../config.ts";

export abstract class Base {
  static readonly taskName: string;

  static provider(settings: TaskSettings | undefined): string {
    return this.required(settings, "provider");
  }

  static model(settings: TaskSettings | undefined): string {
    return this.required(settings, "model");
  }

  static promptOverride(settings: TaskSettings | undefined, prompt = "system"): boolean {
    const overrides = settings?.prompt_override;
    return typeof overrides === "object" && overrides !== null && (overrides as TaskSettings)[prompt] === true;
  }

  static prompt(settings: TaskSettings | undefined, name = "system", options: { userPromptsDir?: string; defaultPromptsDir?: string } = {}): string | undefined {
    if (this.promptOverride(settings, name) && options.userPromptsDir) {
      const override = this.read(join(options.userPromptsDir, this.taskName, `${name}.md`));
      if (override !== undefined) return override;
    }
    return options.defaultPromptsDir ? this.read(join(options.defaultPromptsDir, `${name}.md`)) : undefined;
  }

  static systemPrompt(settings: TaskSettings | undefined, options: { userPromptsDir?: string; defaultPromptsDir?: string } = {}): string | undefined {
    return this.prompt(settings, "system", options);
  }

  private static required(settings: TaskSettings | undefined, key: string): string {
    const value = settings?.[key];
    if (typeof value !== "string" || value === "") throw new Error(`tasks.${this.taskName}.${key} is required in settings.yaml`);
    return value;
  }

  private static read(path: string): string | undefined {
    return existsSync(path) ? readFileSync(path, "utf8").trim() : undefined;
  }
}
