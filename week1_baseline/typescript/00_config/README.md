# 00 · Configuration

TypeScript implementation of Boukensha's configuration layer. It reads
`BOUKENSHA_DIR` (or `~/.boukensha`), loads `.env` without overwriting existing
environment variables, parses `settings.yaml`, and resolves task prompt
overrides from `prompts/<task>/<name>.md` before falling back to the prompt
shipped here.

The supported settings schema is the same as the original step:

```yaml
tasks:
  player:
    provider: anthropic
    model: claude-haiku-4-5
    prompt_override:
      system: true
mud:
  host: localhost
  port: 4000
  username: dummy
  password: helloworld
```

Run the example from the repository root:

```bash
./week1_baseline/bin/00_config
```

Node.js 24 or newer is required so TypeScript files can be run directly.
