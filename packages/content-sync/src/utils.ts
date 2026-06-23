import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

export function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function walkFiles(root: string, extensions = [".md", ".mdx"]): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry.startsWith(".")) continue;
      const fullPath = path.join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (extensions.includes(path.extname(entry))) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files.sort();
}

export function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}
