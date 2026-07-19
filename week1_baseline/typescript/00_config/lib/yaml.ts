export type YamlMap = Record<string, unknown>;

function scalar(raw: string): unknown {
  const value = raw.replace(/\s+#.*$/, "").trim();
  if (value === "") return {};
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

// The settings schema uses nested YAML mappings and scalar values. Keeping this
// small parser local avoids adding a runtime dependency for that deliberate subset.
export function parseYaml(source: string): YamlMap {
  const root: YamlMap = {};
  const stack: Array<{ indent: number; node: YamlMap }> = [{ indent: -1, node: root }];

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (/^\s*(?:#|$)/.test(line)) continue;
    if (/\t/.test(line.match(/^\s*/)?.[0] ?? "")) throw new Error(`Tabs are not supported in YAML indentation (line ${index + 1})`);

    const indent = line.length - line.trimStart().length;
    const match = line.trim().match(/^([^:#][^:]*):(?:\s*(.*))?$/);
    if (!match) throw new Error(`Unsupported YAML syntax on line ${index + 1}`);

    while (stack.length > 1 && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1)!.node;
    const key = match[1].trim();
    const value = scalar(match[2] ?? "");
    parent[key] = value;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      stack.push({ indent, node: value as YamlMap });
    }
  }
  return root;
}
