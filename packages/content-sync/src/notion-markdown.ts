import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Fetch } from "./notion-client.js";
import type { LinkEdge } from "./schema.js";

const MAX_ASSET_BYTES = 25 * 1024 * 1024;

function hostedFile(url: URL): boolean {
  return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443")
    && (/^(?:[a-z0-9.-]+\.)?s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)
      || ["notion.so", "notion-static.com", "notionusercontent.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)));
}

/** 인증 헤더를 전달하지 않고, Notion이 발급한 파일 URL만 로컬 자산으로 저장한다. */
export async function downloadNotionFile(
  source: string, workRoot: string, pageId: string, fetcher: Fetch = fetch,
): Promise<string> {
  let url: URL;
  try { url = new URL(source); } catch { throw new Error(`Notion 파일 URL 형식 오류: ${pageId}`); }
  if (!hostedFile(url)) return source;
  const identity = `${url.origin}${url.pathname}`;
  let response: Response | undefined;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!hostedFile(url)) throw new Error("허용되지 않은 파일 호스트");
      response = await fetcher(url.href, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 3) throw new Error("파일 리다이렉트 오류");
      url = new URL(location, url);
    }
    if (!response || response.status !== 200 || !response.body) throw new Error("파일 다운로드 실패");
    if (Number(response.headers.get("content-length")) > MAX_ASSET_BYTES) throw new Error("파일 크기 초과");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ASSET_BYTES) {
        await reader.cancel();
        throw new Error("파일 크기 초과");
      }
      chunks.push(value);
    }
    if (!size) throw new Error("빈 파일");
    const mime = response.headers.get("content-type")?.split(";")[0];
    const mimeExtensions: Record<string, string> = {
      "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
      "image/svg+xml": ".svg", "image/avif": ".avif", "application/pdf": ".pdf",
      "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg", "video/mp4": ".mp4", "video/webm": ".webm",
    };
    if (mime === "text/html") throw new Error("파일 대신 HTML 응답");
    const extension = mimeExtensions[mime ?? ""] ?? (/\.[a-z0-9]{1,8}$/i.exec(url.pathname)?.[0] ?? ".bin");
    const name = `notion-${createHash("sha256").update(identity).digest("hex").slice(0, 20)}${extension}`;
    const relative = `notion/${pageId}/${name}`;
    const output = path.join(workRoot, "assets", relative);
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, Buffer.concat(chunks));
    return `/post-assets/${relative}`;
  } catch {
    // SDK/응답 오류에 포함될 수 있는 signed URL을 로그로 내보내지 않는다.
    throw new Error(`Notion 첨부파일 다운로드 실패(25MB 제한·권한·만료·네트워크 확인): ${pageId}`);
  }
}

function protectCode(markdown: string): { body: string; restore: (body: string) => string } {
  if (markdown.includes("\0")) throw new Error("Notion 본문에 잘못된 제어 문자가 있습니다.");
  const saved: string[] = [];
  const save = (text: string) => `\0CODE${saved.push(text) - 1}\0`;
  const lines = markdown.split(/(?<=\n)/);
  let body = "";
  let block = "";
  let fence: string | undefined;
  for (const line of lines) {
    if (fence) {
      block += line;
      const close = /^\s*(`+|~+)\s*$/.exec(line.trimEnd());
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
        body += save(block);
        block = "";
        fence = undefined;
      }
    } else {
      const start = /^\s*(`{3,}|~{3,})/.exec(line);
      if (start) { fence = start[1]; block = line; }
      else body += line;
    }
  }
  if (block) throw new Error("Notion 본문의 코드 블록이 닫히지 않았습니다.");
  body = body.replace(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g, (text) => save(text));
  return { body, restore: (value) => value.replace(/\0CODE(\d+)\0/g, (_, index, offset) => {
    const code = saved[Number(index)];
    const inTable = value.slice(value.lastIndexOf("\n", offset) + 1, offset).startsWith("|");
    if (inTable && /^\s*(`{3,}|~{3,})/.test(code)) throw new Error("Notion 표 안의 코드 블록은 표 밖으로 옮겨 주세요.");
    return inTable ? code.replace(/\|/g, "\\|") : code;
  }) };
}

function tableMarkdown(attributes: string, content: string): string {
  if (/\b(?:rowspan|colspan)=/.test(content) || /<table\b/.test(content)) {
    throw new Error("Notion 병합/중첩 표는 지원하지 않습니다.");
  }
  const rows = [...content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((cell) => cell[1].trim().replace(/<br\s*\/?\s*>/g, " ").replace(/\n+/g, " ").replace(/\|/g, "\\|")));
  if (!rows.length || !rows[0].length || rows.some((row) => row.length !== rows[0].length)) {
    throw new Error("Notion 표의 행/열 형식이 올바르지 않습니다.");
  }
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const header = /header-row="true"/.test(attributes) ? rows.shift()! : rows[0].map(() => "");
  return `\n\n${[line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n")}\n\n`;
}

function normalizeProse(body: string): string {
  const result = body
    .replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/g, (_, attributes, content) => tableMarkdown(attributes, content))
    .replace(/\s*\{color="[a-z_]+"\}/g, "")
    .replace(/<empty-block\s*\/>/g, "\n")
    .replace(/<callout\b[^>]*>([\s\S]*?)<\/callout>/g, (_, content) => `\n\n**메모**\n\n${content.trim()}\n\n`)
    .replace(/<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g, (_, title, content) => `\n\n**${title.trim()}**\n\n${content.trim()}\n\n`)
    .replace(/<br\s*\/?\s*>/g, "  \n")
    .replace(/<(https?:\/\/[^>\s]+)>/g, (_, url) => `[${url}](${url})`);
  const unsupported = /<\/?([a-z][a-z_-]*)(?=[\s/>])/.exec(result);
  if (unsupported) throw new Error(`지원하지 않는 Notion 본문 태그: ${unsupported[1]}. 표준 Markdown 블록으로 바꿔 주세요.`);
  // Notion 본문을 JavaScript/JSX로 실행하지 않는다. 코드 예제는 protectCode가 보존한다.
  return result.replace(/</g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;")
    .replace(/(\S)[ \t]{2,}\n/g, (_, last) => last + "\\" + "\n")
    .replace(/[ \t]+\n/g, "\n");
}

type Link = { start: number; end: number; image: boolean; label: string; href: string };

function markdownLinks(body: string): Link[] {
  const links: Link[] = [];
  const startPattern = /(!?)\[([^\]\n]*)\]\(/g;
  let match: RegExpExecArray | null;
  while ((match = startPattern.exec(body))) {
    let end = startPattern.lastIndex;
    let depth = 1;
    for (; end < body.length; end++) {
      if (body[end] === "\\") { end++; continue; }
      if (body[end] === "(") depth++;
      if (body[end] === ")" && --depth === 0) break;
    }
    if (depth !== 0) continue;
    const href = body.slice(startPattern.lastIndex, end).trim().replace(/^<|>$/g, "").replace(/\\([()])/g, "$1");
    links.push({ start: match.index, end: end + 1, image: Boolean(match[1]), label: match[2], href });
    startPattern.lastIndex = end + 1;
  }
  return links;
}

export function internalPostLinks(markdown: string, slugs: Set<string>): Omit<LinkEdge, "sourceSlug">[] {
  const edges: Omit<LinkEdge, "sourceSlug">[] = [];
  for (const link of markdownLinks(protectCode(markdown).body)) {
    if (link.image) continue;
    const match = /^\/posts\/([^/#?]+)\/?(?:#([^?]*))?$/.exec(link.href);
    if (!match) continue;
    let slug: string;
    try { slug = decodeURIComponent(match[1]); } catch { continue; }
    if (slugs.has(slug)) edges.push({ targetSlug: slug, kind: match[2] ? "heading" : "none", ...(match[2] ? { targetAnchor: match[2] } : {}), label: link.label });
  }
  return edges;
}

export async function notionMarkdown(
  markdown: string,
  options: { workRoot: string; pageId: string; slugs: Map<string, string>; fetcher?: Fetch },
): Promise<string> {
  const code = protectCode(markdown);
  const media: string[] = [];
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const renderMedia = (url: string, label: string, image: boolean): string => {
    const extension = /\.[a-z0-9]+$/i.exec(new URL(url, "https://local.invalid").pathname)?.[0].toLowerCase();
    let html: string | undefined;
    if (!image) html = `<a className="file-embed" href="${escape(url)}">${escape(label)}</a>`;
    else if ([".mp4", ".webm", ".mov"].includes(extension ?? "")) html = `<video className="media-embed media-embed-video" controls src="${escape(url)}">${escape(label)}</video>`;
    else if ([".mp3", ".wav", ".ogg", ".m4a", ".flac"].includes(extension ?? "")) html = `<audio className="media-embed media-embed-audio" controls src="${escape(url)}">${escape(label)}</audio>`;
    else if (extension === ".pdf") html = `<iframe className="media-embed media-embed-pdf" src="${escape(url)}" title="${escape(label)}" height="520"></iframe>`;
    return html ? `\0MEDIA${media.push(html) - 1}\0` : `![${label}](${url})`;
  };
  // 에셋 URL의 &를 변형하지 않도록 URL 처리 이후 MDX 문자를 escape한다.
  let body = code.body;
  body = body.replace(/<(?:file|video|audio|pdf|image)\b[^>]*\bsrc="([^"]+)"[^>]*>([\s\S]*?)<\/(?:file|video|audio|pdf|image)>/g,
    (_, url, caption) => `![${caption.trim().replace(/[\[\]\n]/g, " ")}](${url})`)
    .replace(/<(?:file|video|audio|pdf|image)\b[^>]*\bsrc="([^"]+)"[^>]*\/>/g, (_, url) => `![](${url})`);
  for (const link of markdownLinks(body).reverse()) {
    let replacement: string | undefined;
    let url: URL;
    try { url = new URL(link.href); } catch { continue; }
    if (hostedFile(url) && !/\/(?:[a-f0-9]{32}|[^/]*-[a-f0-9]{32})$/i.test(url.pathname)) {
      const local = await downloadNotionFile(url.href, options.workRoot, options.pageId, options.fetcher);
      replacement = renderMedia(local, link.label, link.image);
    } else if (url.hostname === "notion.so" || url.hostname.endsWith(".notion.so")
      || url.hostname === "notion.site" || url.hostname.endsWith(".notion.site")
      || url.hostname === "app.notion.com" || url.hostname === "www.notion.com") {
      const id = /([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(url.pathname)?.[1].replace(/-/g, "").toLowerCase();
      const slug = id && options.slugs.get(id);
      if (slug) replacement = `[${link.label}](/posts/${encodeURIComponent(slug)}/${url.hash})`;
    } else if (link.image && /\.(?:pdf|mp4|webm|mov|mp3|wav|ogg|m4a|flac)$/i.test(url.pathname) && ["https:", "http:"].includes(url.protocol)) {
      replacement = renderMedia(url.href, link.label, true);
    }
    if (replacement) body = body.slice(0, link.start) + replacement + body.slice(link.end);
  }
  return code.restore(normalizeProse(body)).replace(/\0MEDIA(\d+)\0/g, (_, index) => media[Number(index)]).trimEnd() + "\n";
}
