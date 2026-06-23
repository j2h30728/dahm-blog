import type { ParsedNote } from "./schema.js";

const FRONTMATTER_MARKER = "---";

export function parseNote(sourcePath: string, text: string): ParsedNote {
  if (!text.startsWith(`${FRONTMATTER_MARKER}\n`)) {
    return { sourcePath, frontmatter: {}, body: text };
  }

  const closing = text.indexOf(`\n${FRONTMATTER_MARKER}\n`, FRONTMATTER_MARKER.length + 1);
  if (closing === -1) {
    return { sourcePath, frontmatter: {}, body: text };
  }

  const rawFrontmatter = text.slice(FRONTMATTER_MARKER.length + 1, closing);
  const body = text.slice(closing + FRONTMATTER_MARKER.length + 2);
  return {
    sourcePath,
    frontmatter: parseFrontmatter(rawFrontmatter),
    body,
  };
}

export function stringifyFrontmatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${formatValue(value)}`);
  return `${FRONTMATTER_MARKER}\n${lines.join("\n")}\n${FRONTMATTER_MARKER}\n\n`;
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    index += 1;
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!match) continue;

    const [, key, inlineValue = ""] = match;
    if (inlineValue.trim().length > 0) {
      result[key] = parseValue(inlineValue.trim());
      continue;
    }

    const list: string[] = [];
    while (index < lines.length && /^\s+-\s+/.test(lines[index])) {
      list.push(lines[index].replace(/^\s+-\s+/, "").trim());
      index += 1;
    }
    result[key] = list;
  }

  return result;
}

function parseValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (/^\[.*\]$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => stripQuotes(item.trim()));
  }
  return stripQuotes(trimmed);
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(String(value));
}
