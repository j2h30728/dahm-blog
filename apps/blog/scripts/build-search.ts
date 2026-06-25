import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

interface SearchDocument {
  title: string;
  description: string;
  tags: string[];
  series: string;
  url: string;
  searchText: string;
}

const postsRoot = path.resolve("src/content/posts");
const outputRoot = path.resolve("public/search");
mkdirSync(outputRoot, { recursive: true });

const documents = readdirSync(postsRoot)
  .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
  .map((file) => buildSearchDocument(path.join(postsRoot, file)))
  .filter((document): document is SearchDocument => document !== null);

const serialized = JSON.stringify(documents, null, 2);
if (serialized.includes("content/private") || serialized.includes("/private/")) {
  throw new Error("Search index contains private path markers.");
}

writeFileSync(path.join(outputRoot, "index.json"), `${serialized}\n`);

function buildSearchDocument(filePath: string): SearchDocument | null {
  const text = readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(text);
  if (frontmatter.published !== "true") return null;

  const title = frontmatter.title;
  const slug = frontmatter.slug;
  const description = frontmatter.description;
  const series = frontmatter.series;
  const tags = parseArray(frontmatter.tags);
  if (!title || !slug || !description || !series) return null;

  const plainBody = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>\-[\]()]/g, " ");
  const searchText = [title, description, series, tags.join(" "), plainBody].join(" ").toLowerCase();

  return {
    title,
    description,
    tags,
    series,
    url: `/posts/${slug}/`,
    searchText,
  };
}

function parseFrontmatter(text: string): { frontmatter: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) return { frontmatter: {}, body: text };

  const frontmatter: Record<string, string> = {};
  let currentListKey: string | null = null;
  const listValues: string[] = [];

  const flushList = () => {
    if (currentListKey) {
      frontmatter[currentListKey] = `[${listValues.map((item) => `"${item}"`).join(", ")}]`;
      currentListKey = null;
      listValues.length = 0;
    }
  };

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = /^\s*-\s*(.*)$/.exec(line);
    if (currentListKey && listItem) {
      listValues.push(cleanScalar(listItem[1]));
      continue;
    }

    flushList();

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (pair) {
      if (pair[2].trim() === "") {
        currentListKey = pair[1];
      } else {
        frontmatter[pair[1]] = cleanScalar(pair[2]);
      }
    }
  }
  flushList();
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

function cleanScalar(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}
