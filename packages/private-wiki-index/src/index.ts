import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createLocalEmbedding, type LocalEmbedding } from "./embeddings.js";
import { isAllowedPath, resolveScope, type ScopeConfig } from "./scope.js";

export interface PrivateWikiDocument {
  id: string;
  sourcePath: string;
  title: string;
  tags: string[];
  text: string;
  checksum: string;
  embedding: LocalEmbedding;
}

export interface PrivateWikiIndex {
  generatedAt: string;
  scope: {
    include: string[];
    exclude: string[];
  };
  documents: PrivateWikiDocument[];
}

export interface BuildPrivateIndexOptions extends ScopeConfig {
  outputPath: string;
}

export function buildPrivateIndex(options: BuildPrivateIndexOptions): PrivateWikiIndex {
  const { includeRoots, excludeRoots } = resolveScope(options);
  const documents = walkMarkdown(options.vaultRoot)
    .filter((file) => isAllowedPath(file, includeRoots, excludeRoots))
    .map(readDocument);

  const index: PrivateWikiIndex = {
    generatedAt: new Date().toISOString(),
    scope: {
      include: includeRoots,
      exclude: excludeRoots,
    },
    documents,
  };

  const outputPath = path.resolve(options.outputPath);
  if (outputPath.includes(`${path.sep}apps${path.sep}blog${path.sep}public${path.sep}`)) {
    throw new Error("Private wiki index cannot be written into the public blog directory.");
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

function readDocument(filePath: string): PrivateWikiDocument {
  const raw = readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const title = frontmatter.title ?? path.basename(filePath, path.extname(filePath));
  const tags = parseArray(frontmatter.tags);
  const text = body.replace(/```[\s\S]*?```/g, " ").replace(/[#*_`>\-[\]()]/g, " ");

  return {
    id: createHash("sha1").update(filePath).digest("hex"),
    sourcePath: filePath,
    title,
    tags,
    text,
    checksum: createHash("sha256").update(raw).digest("hex"),
    embedding: createLocalEmbedding([title, tags.join(" "), text].join(" ")),
  };
}

function walkMarkdown(root: string): string[] {
  const files: string[] = [];
  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry.startsWith(".")) continue;
      const fullPath = path.join(current, entry);
      const stat = readdirOrFile(fullPath);
      if (stat === "directory") {
        walk(fullPath);
      } else if (stat === "file" && [".md", ".mdx"].includes(path.extname(fullPath))) {
        files.push(fullPath);
      }
    }
  }
  walk(path.resolve(root));
  return files.sort();
}

function readdirOrFile(fullPath: string): "directory" | "file" {
  return readdirSync(path.dirname(fullPath), { withFileTypes: true }).find((entry) => path.join(path.dirname(fullPath), entry.name) === fullPath)?.isDirectory()
    ? "directory"
    : "file";
}

function parseFrontmatter(text: string): { frontmatter: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) return { frontmatter: {}, body: text };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (pair) {
      frontmatter[pair[1]] = pair[2].replace(/^"|"$/g, "");
    }
  }
  return { frontmatter, body: match[2] };
}

function parseArray(value = ""): string[] {
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}
