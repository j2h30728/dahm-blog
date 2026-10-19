import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { HeadingNode, NotionPost, PostIndexEntry, PublishOptions } from "./schema.js";
import { internalPostLinks } from "./notion-markdown.js";
import { plainText, slugify, slugifyHeading } from "./utils.js";

export function extractHeadings(body: string): HeadingNode[] {
  const headings: HeadingNode[] = [];
  const used = new Set<string>();
  let fence: string | undefined;
  for (const line of body.split("\n")) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    const match = /^(#{2,3})\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (!match) continue;
    const text = plainText(match[2]);
    const base = slugifyHeading(text);
    let id = base;
    for (let suffix = 1; used.has(id); suffix++) id = `${base}-${suffix}`;
    used.add(id);
    headings.push({ depth: match[1].length as 2 | 3, text, id });
  }
  return headings;
}

function postIndex(posts: NotionPost[]): PostIndexEntry[] {
  return posts.map(({ id: _id, body, ...fields }) => {
    const seriesSlug = fields.series ? slugify(fields.series) : undefined;
    return {
      ...fields, href: `/posts/${encodeURIComponent(fields.slug)}/`,
      tagSlugs: Object.fromEntries(fields.tags.map((tag) => [tag, slugify(tag)])),
      excerpt: plainText(body).slice(0, 240), headings: extractHeadings(body),
      ...(seriesSlug ? { seriesSlug, seriesHref: `/series/${seriesSlug}/` } : {}),
    };
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.title.localeCompare(b.title));
}

function moduleMap(posts: NotionPost[], options: PublishOptions): string {
  const entries = [...posts].sort((a, b) => a.slug.localeCompare(b.slug));
  const imports = entries.map((post) => {
    let target = path.relative(path.dirname(options.postModuleMapPath), path.join(options.outputDir, `${post.slug}.mdx`)).split(path.sep).join("/");
    if (!target.startsWith(".")) target = `./${target}`;
    return `  ${JSON.stringify(post.slug)}: () => import(${JSON.stringify(target)}),`;
  });
  return `import type { ComponentType } from "react";\n\nexport type PostModule = { default: ComponentType };\n\nexport const postModules: Record<string, () => Promise<PostModule>> = {\n${imports.join("\n")}\n};\n\nexport const postModuleSlugs = ${JSON.stringify(entries.map((post) => post.slug))} as const;\n`;
}

/** 전체 결과를 먼저 준비하고, 실패하면 이전 생성물을 복원한다. */
export function publishPosts(posts: NotionPost[], assetDir: string, options: PublishOptions): PostIndexEntry[] {
  const slugs = new Set<string>();
  const tags = new Map<string, string>();
  const series = new Map<string, string>();
  const validateLabel = (label: string, routes: Map<string, string>, kind: string) => {
    const slug = slugify(label);
    const existing = routes.get(slug);
    if (!slug || (existing !== undefined && existing !== label)) {
      throw new Error(`${kind} 이름이 빈 URL 또는 중복된 URL을 만듭니다: ${label}`);
    }
    routes.set(slug, label);
  };
  for (const post of posts) {
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(post.slug) || slugs.has(post.slug)) {
      throw new Error("게시 입력에 잘못되었거나 중복된 slug가 있습니다.");
    }
    slugs.add(post.slug);
    for (const tag of post.tags) validateLabel(tag, tags, "태그");
    if (post.series) validateLabel(post.series, series, "시리즈");
  }
  const targets = Object.values(options).map((value) => path.resolve(value));
  if (new Set(targets).size !== targets.length || targets.some((target) => target === path.parse(target).root)) {
    throw new Error("게시 출력 경로는 서로 달라야 하며 파일 시스템 루트를 사용할 수 없습니다.");
  }
  for (const directory of [options.outputDir, options.assetOutputDir].map((value) => path.resolve(value))) {
    if (targets.some((target) => target !== directory && target.startsWith(directory + path.sep))) {
      throw new Error("게시 출력 디렉터리와 인덱스 경로가 겹칩니다.");
    }
  }
  mkdirSync(path.dirname(options.outputDir), { recursive: true });
  const stage = mkdtempSync(path.join(path.dirname(options.outputDir), ".publish-"));
  const moved: Array<{ target: string; backup?: string; installed: boolean }> = [];
  let cleanupStage = true;
  try {
    const entries = postIndex(posts);
    const generatedAt = new Date().toISOString();
    const stagedPosts = path.join(stage, "posts");
    mkdirSync(stagedPosts);
    for (const post of posts) writeFileSync(path.join(stagedPosts, `${post.slug}.mdx`), post.body.trimEnd() + "\n");
    const stagedAssets = path.join(stage, "assets");
    cpSync(assetDir, stagedAssets, { recursive: true });
    const artifacts: Array<{ target: string; source: string }> = [
      { target: options.outputDir, source: stagedPosts },
      { target: options.assetOutputDir, source: stagedAssets },
    ];
    const addFile = (target: string, content: unknown, raw = false) => {
      const source = path.join(stage, `file-${artifacts.length}`);
      writeFileSync(source, raw ? String(content) : JSON.stringify(content, null, 2) + "\n");
      artifacts.push({ target, source });
    };
    addFile(options.publicPostIndexPath, { generatedAt, posts: entries });
    addFile(options.publicLinkIndexPath, {
      generatedAt, nodes: entries,
      edges: posts.flatMap((post) => internalPostLinks(post.body, slugs).map((edge) => ({ sourceSlug: post.slug, ...edge }))),
    });
    addFile(options.searchIndexPath, posts.map((post) => ({
      title: post.title, description: post.description, topic: post.topic, tags: post.tags, series: post.series,
      url: `/posts/${encodeURIComponent(post.slug)}/`,
      searchText: [post.title, post.description, post.topic, post.series, post.tags.join(" "), plainText(post.body)].filter(Boolean).join(" ").toLowerCase(),
    })).sort((a, b) => a.url.localeCompare(b.url)));
    addFile(options.postModuleMapPath, moduleMap(posts, options), true);
    addFile(options.manifestPath, { source: "notion", generatedAt, posts: posts.map(({ id, slug }) => ({ id, slug })) });
    mkdirSync(path.join(stage, "backups"));
    for (const artifact of artifacts) {
      mkdirSync(path.dirname(artifact.target), { recursive: true });
      const change = { target: artifact.target, backup: undefined as string | undefined, installed: false };
      moved.push(change);
      if (existsSync(change.target)) {
        change.backup = path.join(stage, "backups", String(moved.length));
        renameSync(change.target, change.backup);
      }
      renameSync(artifact.source, change.target);
      change.installed = true;
    }
    return entries;
  } catch (error) {
    for (const change of moved.reverse()) {
      try {
        if (change.installed) rmSync(change.target, { recursive: true, force: true });
        if (change.backup && existsSync(change.backup)) renameSync(change.backup, change.target);
      } catch { cleanupStage = false; }
    }
    if (!cleanupStage) throw new Error(`게시 출력 복원에 실패했습니다. 백업을 확인하세요: ${stage}`);
    throw error;
  } finally {
    if (cleanupStage) rmSync(stage, { recursive: true, force: true });
  }
}
