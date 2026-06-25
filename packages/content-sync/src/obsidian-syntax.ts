import type { CalloutDescriptor, TaskItem } from "./schema.js";

export interface ObsidianSyntaxResult {
  body: string;
  tags: string[];
  tasks: TaskItem[];
  callouts: CalloutDescriptor[];
}

export function normalizeObsidianSyntax(body: string): ObsidianSyntaxResult {
  const withoutComments = stripObsidianComments(body);
  const callouts = extractCallouts(withoutComments);
  const tasks = extractTasks(withoutComments);
  const tags = extractInlineTags(withoutComments);
  const normalizedBody = normalizeTaskMarkers(normalizeCallouts(normalizeHighlights(withoutComments)));

  return {
    body: normalizedBody,
    tags,
    tasks,
    callouts,
  };
}

export function stripObsidianComments(body: string): string {
  const lines = body.split(/\r?\n/);
  let inFence = false;
  let inComment = false;

  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      let output = "";
      let index = 0;
      let inCode = false;

      while (index < line.length) {
        if (line[index] === "`") {
          inCode = !inCode;
          if (!inComment) output += line[index];
          index += 1;
          continue;
        }

        if (!inCode && line.startsWith("%%", index)) {
          inComment = !inComment;
          index += 2;
          continue;
        }

        if (!inComment) {
          output += line[index];
        }
        index += 1;
      }

      return output.trimEnd();
    })
    .join("\n");
}

function normalizeHighlights(body: string): string {
  return mapNonFenceLines(body, (line) => mapOutsideInlineCode(line, (part) => part.replace(/==([^=\n]+)==/g, "<mark>$1</mark>")));
}

function normalizeCallouts(body: string): string {
  return mapNonFenceLines(body, (line) =>
    line.replace(/^(\s*(?:>\s*)+)\[!([A-Za-z][\w-]*)\]([+-])?\s*(.*)$/u, (_match, prefix, type, fold, title) => {
      const normalizedType = normalizeCalloutType(String(type));
      const label = title ? String(title).trim() : toTitleCase(normalizedType);
      const foldAttribute = fold === "+" ? ' data-callout-fold="open"' : fold === "-" ? ' data-callout-fold="closed"' : "";
      return `${prefix}<span class="callout-title" data-callout="${escapeAttribute(normalizedType)}"${foldAttribute}>${escapeHtml(label)}</span>`;
    }),
  );
}

function normalizeTaskMarkers(body: string): string {
  return mapNonFenceLines(body, (line) =>
    line.replace(/^(\s*[-*+]\s+)\[([^\]\s])\]\s+(.+)$/u, (_match, prefix, marker, text) => {
      const normalizedMarker = String(marker).toLowerCase();
      if (normalizedMarker === "x") {
        return `${prefix}[x] ${text}`;
      }
      return `${prefix}[x] <span class="task-marker" data-task-marker="${escapeAttribute(String(marker))}"></span> ${text}`;
    }),
  );
}

function extractCallouts(body: string): CalloutDescriptor[] {
  const callouts: CalloutDescriptor[] = [];
  for (const line of nonFenceLines(body)) {
    const match = /^\s*(?:>\s*)+\[!([A-Za-z][\w-]*)\]([+-])?\s*(.*)$/u.exec(line);
    if (!match) continue;
    const [, type, fold, title] = match;
    callouts.push({
      type: normalizeCalloutType(type),
      title: title.trim() || toTitleCase(type),
      fold: fold === "+" ? "open" : fold === "-" ? "closed" : undefined,
    });
  }
  return callouts;
}

function extractTasks(body: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  for (const line of nonFenceLines(body)) {
    const match = /^\s*[-*+]\s+\[([^\]])\]\s+(.+)$/u.exec(line);
    if (!match) continue;
    const [, marker, text] = match;
    tasks.push({
      marker,
      completed: marker !== " ",
      text: text.trim(),
    });
  }
  return tasks;
}

export function extractInlineTags(body: string): string[] {
  const tags = new Set<string>();
  for (const line of nonFenceLines(body)) {
    mapOutsideInlineCode(line, (part) => {
      const tagSource = part.replace(/\[\[[^\]]+\]\]/g, " ").replace(/\[[^\]]+\]\([^)]+\)/g, " ");
      for (const match of tagSource.matchAll(/(^|[\s([{"'])#([^\s#.,;:!?()[\]{}'"`<>]+)/gu)) {
        const tag = match[2].replace(/\\+$/g, "");
        if (tag && /[^\d/]/u.test(tag)) {
          tags.add(tag);
        }
      }
      return part;
    });
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function mapNonFenceLines(body: string, mapLine: (line: string) => string): string {
  const lines = body.split(/\r?\n/);
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : mapLine(line);
    })
    .join("\n");
}

function nonFenceLines(body: string): string[] {
  const lines: string[] = [];
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) lines.push(line);
  }
  return lines;
}

function mapOutsideInlineCode(line: string, mapPart: (part: string) => string): string {
  let output = "";
  let current = "";
  let inCode = false;

  for (const char of line) {
    if (char === "`") {
      output += inCode ? current + char : mapPart(current) + char;
      current = "";
      inCode = !inCode;
      continue;
    }
    current += char;
  }

  output += inCode ? current : mapPart(current);
  return output;
}

function normalizeCalloutType(type: string): string {
  const normalized = type.toLowerCase();
  const aliases: Record<string, string> = {
    summary: "abstract",
    tldr: "abstract",
    hint: "tip",
    important: "tip",
    check: "success",
    done: "success",
    help: "question",
    faq: "question",
    caution: "warning",
    attention: "warning",
    fail: "failure",
    missing: "failure",
    error: "danger",
    cite: "quote",
  };
  return aliases[normalized] ?? normalized;
}

function toTitleCase(value: string): string {
  return value.replace(/^\w/, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
