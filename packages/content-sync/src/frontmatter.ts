import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
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
  return `${FRONTMATTER_MARKER}\n${stringifyYaml(fields).trimEnd()}\n${FRONTMATTER_MARKER}\n\n`;
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const parsed = parseYaml(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, normalizePropertyValue(value)]),
  );
}

function normalizePropertyValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizePropertyValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizePropertyValue(item)]),
    );
  }
  return value;
}
