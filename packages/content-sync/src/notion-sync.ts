import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { NotionClient, notionId, object, property, selectProperty, textProperty, type Fetch, type NotionConfig, type NotionPage } from "./notion-client.js";
import { notionMarkdown } from "./notion-markdown.js";
import type { NotionPost } from "./schema.js";

export function notionConfig(env: NodeJS.ProcessEnv): NotionConfig {
  if (env.CONTENT_SOURCE && env.CONTENT_SOURCE !== "notion") {
    throw new Error("파일 게시 모드는 제거되었습니다. CONTENT_SOURCE를 지우고 Notion API를 설정하세요.");
  }
  const token = env.NOTION_TOKEN?.trim();
  const dataSourceId = env.NOTION_DATA_SOURCE_ID?.trim();
  const databaseId = env.NOTION_DATABASE_ID?.trim();
  if (!token || (!dataSourceId && !databaseId)) {
    throw new Error("Notion 연동에는 NOTION_TOKEN과 NOTION_DATA_SOURCE_ID(또는 NOTION_DATABASE_ID)가 필요합니다.");
  }
  if (dataSourceId) notionId(dataSourceId);
  if (databaseId) notionId(databaseId);
  return { token, dataSourceId, databaseId };
}

function metadata(page: NotionPage): Omit<NotionPost, "body"> {
  const slug = textProperty(page, "slug").normalize("NFC");
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(slug)) {
    throw new Error(`Notion 발행 글에 올바른 slug를 입력하세요: ${page.id}`);
  }
  const title = textProperty(page, "title");
  const description = textProperty(page, "summary");
  const dateValue = property(page, "date").date;
  const date = dateValue && object(dateValue, "date").start;
  const tagValues = property(page, "tags").multi_select;
  if (!Array.isArray(tagValues)) throw new Error(`Notion tags 속성 형식 오류: ${page.id}`);
  const tags = [...new Set(tagValues.map((tag) => String(object(tag, "tag").name ?? "")).filter(Boolean))];
  const updated = page.last_edited_time;
  if (!title || !description || typeof date !== "string" || Number.isNaN(Date.parse(date))
    || !tags.length || Number.isNaN(Date.parse(updated))) {
    throw new Error(`Notion 발행 글의 title·summary·date·tags·수정일을 확인하세요: ${page.id}`);
  }
  const series = page.properties.series ? selectProperty(page, "series") : "";
  const order = page.properties.seriesOrder ? property(page, "seriesOrder").number : null;
  if (order !== null && (typeof order !== "number" || !Number.isFinite(order))) {
    throw new Error(`Notion seriesOrder 속성 형식 오류: ${page.id}`);
  }
  return {
    id: notionId(page.id), title, slug, description, date, updated, tags,
    topic: selectProperty(page, "category") || "general",
    ...(series ? { series } : {}),
    ...(order !== null ? { seriesOrder: order } : {}),
  };
}

/** 게시 입력은 API 결과뿐이다. 저장소의 Markdown·사본을 읽지 않는다. */
export async function fetchNotionContent(
  root: string, config: NotionConfig, fetcher: Fetch = fetch,
): Promise<{ posts: NotionPost[]; assetDir: string; cleanup: () => void }> {
  const work = path.join(root, ".content-sync");
  mkdirSync(work, { recursive: true });
  const workRoot = mkdtempSync(path.join(work, "notion-"));
  const assetDir = path.join(workRoot, "assets");
  mkdirSync(assetDir);
  const cleanup = () => rmSync(workRoot, { recursive: true, force: true });
  try {
    const client = new NotionClient(config, fetcher);
    const pages = (await client.publishedPosts()).map(metadata);
    const slugs = new Map<string, string>();
    const uniqueSlugs = new Set<string>();
    for (const post of pages) {
      if (uniqueSlugs.has(post.slug)) throw new Error(`Notion 글의 slug가 중복됩니다: ${post.slug}`);
      uniqueSlugs.add(post.slug);
      slugs.set(post.id, post.slug);
    }
    const posts: NotionPost[] = [];
    for (const post of pages) {
      const body = await notionMarkdown(await client.markdown(post.id), {
        workRoot, pageId: post.id, slugs, fetcher,
      });
      posts.push({ ...post, body });
    }
    return { posts, assetDir, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
