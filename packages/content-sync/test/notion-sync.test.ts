import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { NotionClient, type Fetch, type NotionPage } from "../src/notion-client.js";
import { notionMarkdown, downloadNotionFile } from "../src/notion-markdown.js";
import { fetchNotionContent, notionConfig } from "../src/notion-sync.js";
import { extractHeadings, publishPosts } from "../src/publish.js";
import type { PublishOptions } from "../src/schema.js";
import { loadWorkspaceEnv } from "../src/runtime-env.js";

const first = "11111111111111111111111111111111";
const second = "22222222222222222222222222222222";
const dataSourceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const config = { token: "test-token-do-not-print", dataSourceId };
const imageUrl = "https://prod-files-secure.s3.us-west-2.amazonaws.com/page/example.png?signature=temporary";
const schema = { properties: { status: { type: "select" }, type: { type: "select" } } };
const rich = (text: string) => ({ type: "rich_text", rich_text: [{ plain_text: text }] });

function page(
  id = first, slug = "new-post", status = "published", section?: string | null,
): NotionPage & { object: string } {
  const result: NotionPage & { object: string } = {
    object: "page", id, last_edited_time: "2026-10-19T01:00:00.000Z",
    properties: {
      title: { type: "title", title: [{ plain_text: "새 글" }] },
      slug: rich(slug), summary: rich("글 요약"),
      status: { type: "select", select: { name: status } },
      type: { type: "select", select: { name: "post" } },
      category: { type: "select", select: { name: "frontend" } },
      date: { type: "date", date: { start: "2026-10-19" } },
      tags: { type: "multi_select", multi_select: [{ name: "React" }] },
    },
  };
  if (section !== undefined) {
    result.properties.section = { type: "select", select: section === null ? null : { name: section } };
  }
  return result;
}

const json = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), { status, headers });

function api(pages: NotionPage[], markdown = "## 본문\n\n본문입니다.\n"): Fetch {
  return async (url, init) => {
    if (url.startsWith("https://api.notion.com/")) {
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${config.token}`);
      assert.equal(new Headers(init?.headers).get("Notion-Version"), "2026-03-11");
    }
    if (url.endsWith("/query")) return json({ results: pages, has_more: false, next_cursor: null });
    if (url.includes("/data_sources/")) return json(schema);
    if (url.endsWith("/markdown")) return json({ markdown, truncated: false, unknown_block_ids: [] });
    if (url === imageUrl) {
      assert.equal(new Headers(init?.headers).get("Authorization"), null);
      return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
    }
    throw new Error("예상하지 않은 요청");
  };
}

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "notion-sync-test-"));
  mkdirSync(path.join(root, "content/public/published"), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function localPost(root: string, name: string, slug: string, owner?: string): string {
  const file = path.join(root, "content/public/published", name);
  writeFileSync(file, `---\ntitle: 기존 글\nslug: ${slug}\ndescription: 기존 요약\ndate: 2026-01-01\ntags: [기존]\npublished: true\n${owner ? `notionPageId: "${owner}"\n` : ""}---\n\n## 기존 본문\n`);
  return file;
}

function outputOptions(root: string): PublishOptions {
  const target = path.join(root, "output");
  return {
    outputDir: path.join(target, "posts"), assetOutputDir: path.join(target, "post-assets"),
    publicPostIndexPath: path.join(target, "posts.json"), publicLinkIndexPath: path.join(target, "links.json"),
    manifestPath: path.join(target, "manifest.json"), searchIndexPath: path.join(target, "search.json"),
    postModuleMapPath: path.join(target, "post-modules.ts"),
    imageManifestPath: path.join(target, "image-manifest.json"),
  };
}

function publish(root: string, content: Awaited<ReturnType<typeof fetchNotionContent>>) {
  return publishPosts(content.posts, content.assetDir, outputOptions(root));
}

test("section이 없거나 비어 있으면 기술 글이며 한글·영문 선택값을 분류로 변환한다", async (t) => {
  const root = workspace(t);
  const cases = [
    { section: undefined, expected: "tech" },
    { section: null, expected: "tech" },
    { section: "기술", expected: "tech" },
    { section: "tech", expected: "tech" },
    { section: "일상", expected: "life" },
    { section: "life", expected: "life" },
  ] as const;

  for (const { section, expected } of cases) {
    const prepared = await fetchNotionContent(root, config, api([page(first, "new-post", "published", section)]));
    try {
      assert.equal(prepared.posts[0]?.category, expected);
      assert.equal(prepared.posts[0]?.topic, "frontend");
    } finally {
      prepared.cleanup();
    }
  }
});

test("모든 글의 이미지 준비가 성공한 뒤에만 이미지 캐시를 한 번 확정한다", async (t) => {
  const root = workspace(t);
  const calls: string[] = [];
  const asset = {
    src: "https://cdn.example.com/cached.webp", originalSrc: "https://cdn.example.com/original.png",
    width: 640, height: 320, originalWidth: 1200, originalHeight: 600,
    variants: [{ src: "https://cdn.example.com/cached.webp", width: 640 }],
  };
  const result = await fetchNotionContent(root, config, api([page(), page(second, "other")], `![사진](${imageUrl})`), () => ({
    manifest: { version: 1, images: {} },
    process: async () => { calls.push("image"); return asset; },
    flush: async () => { calls.push("flush"); },
  }));
  t.after(result.cleanup);
  assert.equal(result.posts.length, 2);
  assert.deepEqual(calls, ["image", "image", "flush"]);
});

test("이미지 준비가 실패하면 캐시를 확정하지 않고 임시 게시 결과를 정리한다", async (t) => {
  const root = workspace(t);
  let flushed = false;
  await assert.rejects(fetchNotionContent(root, config, api([page()], `![사진](${imageUrl})`), () => ({
    manifest: { version: 1, images: {} },
    process: async () => { throw new Error("변환 실패"); },
    flush: async () => { flushed = true; },
  })), /변환 실패/);
  assert.equal(flushed, false);
  assert.deepEqual(readdirSync(path.join(root, ".content-sync")).filter((name) => name.startsWith("notion-")), []);
});

test("지원하지 않는 section 선택값은 해당 값과 페이지를 알리는 오류로 중단한다", async (t) => {
  const root = workspace(t);
  await assert.rejects(
    fetchNotionContent(root, config, api([page(first, "new-post", "published", "회고")])),
    (error: Error) => error.message.includes("section") && error.message.includes("회고") && error.message.includes(first),
  );
});

test("글 분류를 공개 글·링크·검색 인덱스에 동일하게 전달한다", async (t) => {
  const root = workspace(t);
  const prepared = await fetchNotionContent(root, config, api([page(first, "new-post", "published", "일상")]));
  t.after(prepared.cleanup);

  const entries = publish(root, prepared);
  const posts = JSON.parse(readFileSync(outputOptions(root).publicPostIndexPath, "utf8"));
  const links = JSON.parse(readFileSync(outputOptions(root).publicLinkIndexPath, "utf8"));
  const search = JSON.parse(readFileSync(outputOptions(root).searchIndexPath, "utf8"));

  assert.equal(entries[0]?.category, "life");
  assert.equal(posts.posts[0]?.category, "life");
  assert.equal(links.nodes[0]?.category, "life");
  assert.equal(search[0]?.category, "life");
});

test("Notion에 없는 파일 글은 무시하고 DB의 글·URL·본문·에셋만 게시한다", async (t) => {
  const root = workspace(t);
  const source = localPost(root, "legacy.md", "stable-url", first);
  const before = readFileSync(source, "utf8");
  localPost(root, "untouched.md", "new-post");
  const prepared = await fetchNotionContent(root, config, api([page()], `## 새 본문\n\n![설명](${imageUrl})\n`));
  t.after(prepared.cleanup);
  const result = publish(root, prepared);
  assert.deepEqual(result.map((post) => post.slug), ["new-post"]);
  const mdx = readFileSync(path.join(root, "output/posts/new-post.mdx"), "utf8");
  assert.match(mdx, /새 본문/);
  assert.match(mdx, /\/post-assets\/notion\/.+\.png/);
  assert.doesNotMatch(mdx, /signature=|notionPageId|test-token/);
  assert.equal(readdirSync(path.join(root, "output/post-assets/notion", first)).length, 1);
  assert.equal(readFileSync(source, "utf8"), before);
  const index = JSON.parse(readFileSync(path.join(root, "output/posts.json"), "utf8"));
  assert.equal(index.posts.find((post: { slug: string }) => post.slug === "new-post").description, "글 요약");
  assert.doesNotMatch(readFileSync(path.join(root, "output/links.json"), "utf8"), /notionPageId/);
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, "output/image-manifest.json"), "utf8")), { version: 1, images: {} });
});

test("Notion 글이 비공개·삭제되면 모든 출력에서 제거하고 과거 파일로 대체하지 않는다", async (t) => {
  const root = workspace(t);
  const source = localPost(root, "legacy.md", "stable-url", first);
  const initial = await fetchNotionContent(root, config, api([page()], `![첨부](${imageUrl})`));
  try { publish(root, initial); } finally { initial.cleanup(); }
  for (const pages of [[page(first, "changed", "draft")], []]) {
    const prepared = await fetchNotionContent(root, config, api(pages));
    try {
      assert.equal(publish(root, prepared).length, 0);
      assert.equal(existsSync(source), true);
      assert.deepEqual(JSON.parse(readFileSync(path.join(root, "output/posts.json"), "utf8")).posts, []);
      assert.deepEqual(readdirSync(path.join(root, "output/posts")), []);
      assert.deepEqual(readdirSync(path.join(root, "output/post-assets")), []);
      assert.deepEqual(JSON.parse(readFileSync(path.join(root, "output/search.json"), "utf8")), []);
      assert.deepEqual(JSON.parse(readFileSync(path.join(root, "output/links.json"), "utf8")).edges, []);
      assert.doesNotMatch(readFileSync(path.join(root, "output/post-modules.ts"), "utf8"), /new-post/);
    } finally { prepared.cleanup(); }
  }
});

test("공개 목록이 줄거나 본문이 수정된 다음 실행에 이전 데이터를 남기지 않는다", async (t) => {
  const root = workspace(t);
  for (const [pages, text] of [[[page(), page(second, "second-post")], "첫 내용"], [[page()], "수정 내용"]] as const) {
    const prepared = await fetchNotionContent(root, config, api([...pages], `## ${text}\n`));
    try { publish(root, prepared); } finally { prepared.cleanup(); }
  }
  assert.equal(existsSync(path.join(root, "output/posts/second-post.mdx")), false);
  assert.match(readFileSync(path.join(root, "output/posts/new-post.mdx"), "utf8"), /수정 내용/);
});

test("페이지네이션을 끝까지 읽고 공개 필터·cursor를 API에 전달한다", async () => {
  let queries = 0;
  const client = new NotionClient(config, async (url, init) => {
    if (!url.endsWith("/query")) return json(schema);
    const query = JSON.parse(String(init?.body));
    assert.deepEqual(query.filter.and, [
      { property: "status", select: { equals: "published" } }, { property: "type", select: { equals: "post" } },
    ]);
    queries++;
    assert.equal(query.start_cursor, queries === 1 ? undefined : "next");
    return json({ results: [page(queries === 1 ? first : second)], has_more: queries === 1, next_cursor: queries === 1 ? "next" : null });
  });
  assert.equal((await client.publishedPosts()).length, 2);
  assert.equal(queries, 2);
});

test("database ID만 설정해도 단일 data source를 찾고 status 속성 타입을 지원한다", async () => {
  const client = new NotionClient({ token: config.token, databaseId: dataSourceId }, async (url, init) => {
    if (url.includes("/databases/")) return json({ data_sources: [{ id: dataSourceId }] });
    if (!url.endsWith("/query")) return json({ properties: { status: { type: "status" }, type: { type: "select" } } });
    assert.deepEqual(JSON.parse(String(init?.body)).filter.and[0], { property: "status", status: { equals: "published" } });
    return json({ results: [], has_more: false });
  });
  assert.deepEqual(await client.publishedPosts(), []);
});

test("429 Retry-After를 존중하고 인증 오류·미완성 목록·본문은 실패시킨다", async () => {
  const waits: number[] = [];
  let tries = 0;
  const client = new NotionClient(config, async () => ++tries === 1
    ? json({}, 429, { "Retry-After": "2" }) : json({ markdown: "본문", truncated: false, unknown_block_ids: [] }),
  async (ms) => { waits.push(ms); });
  assert.equal(await client.markdown(first), "본문");
  assert.deepEqual(waits, [2000]);
  await assert.rejects(new NotionClient(config, async () => json({ message: config.token }, 401)).markdown(first), (error: Error) => {
    assert.doesNotMatch(error.message, /test-token/); return /401/.test(error.message);
  });
  await assert.rejects(new NotionClient(config, async (url) => url.endsWith("/query")
    ? json({ results: [], has_more: true, next_cursor: null }) : json(schema)).publishedPosts(), /페이지네이션/);
  await assert.rejects(new NotionClient(config, async () => json({ markdown: "일부", truncated: true, unknown_block_ids: [first] })).markdown(first), /잘렸거나/);
});

test("slug 충돌·경로 이탈·필수값 누락·API 실패는 원본과 기존 출력을 보존한다", async (t) => {
  const root = workspace(t);
  const source = localPost(root, "keep.md", "existing");
  mkdirSync(path.join(root, "output"));
  const output = path.join(root, "output/keep.txt");
  writeFileSync(output, "기존 출력");
  const bad = page();
  bad.properties.tags = { type: "multi_select", multi_select: [] };
  for (const fetcher of [api([page(), page(second)]), api([page(first, "../escape")]), api([bad]), async () => json({}, 403)]) {
    await assert.rejects(fetchNotionContent(root, config, fetcher));
    assert.equal(existsSync(source), true);
    assert.equal(readFileSync(output, "utf8"), "기존 출력");
    assert.deepEqual(readdirSync(path.join(root, ".content-sync")), []);
  }
});

test("표준 Markdown·코드 예제를 보존하고 MDX 표현식을 escape하며 공개 글 링크를 연결한다", async (t) => {
  const root = workspace(t);
  const code = "```tsx\n<List.Root value={secret}>\n![가짜](https://example.com/fake.png)\n</List.Root>\n```";
  const result = await notionMarkdown(`## 제목\n\n> 인용\n\n{process.env.SECRET}\n\n${code}\n\n\`<unknown />\`\n\n[다른 글](https://www.notion.so/${second})\n`, {
    workRoot: root, pageId: first, slugs: new Map([[second, "other"]]), fetcher: async () => { throw new Error("코드 내 URL을 요청하면 안 됨"); },
  });
  assert.ok(result.includes(code));
  assert.match(result, /> 인용/);
  assert.match(result, /&#123;process.env.SECRET&#125;/);
  assert.match(result, /`<unknown \/>`/);
  assert.match(result, /\[다른 글\]\(\/posts\/other\/\)/);
  const nested = "`` `<List.Root value={x} />` ``";
  assert.ok((await notionMarkdown(nested, { workRoot: root, pageId: first, slugs: new Map() })).includes(nested));
  await assert.rejects(notionMarkdown("<unknown id=\"x\"/>", { workRoot: root, pageId: first, slugs: new Map() }), /지원하지 않는/);
});

test("Notion의 단일 개행 블록과 br 줄바꿈을 구분하고 인용 범위를 닫는다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  assert.equal(await notionMarkdown("첫 문단\n둘째 문단<br>같은 문단\n> 인용<br>둘째 줄\n인용 밖", options),
    "첫 문단\n\n둘째 문단\\\n같은 문단\n\n> 인용\n> 둘째 줄\n\n인용 밖\n");
});

test("인용 안 줄바꿈 목록과 native 자식·목록 번호·중첩을 보존한다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  const source = "> 환경<br>- React<br>- Next.js\n인용 밖\n> Native 인용\n\t- 자식 목록\n\t\t1. 손자 목록\n7. 일곱<br>설명\n\t- 하위 목록\n8. 여덟\n다음 문단";
  const result = await notionMarkdown(source, options);
  assert.match(result, /> 환경\n>\s*\n> - React\n> - Next\.js\n\n인용 밖/);
  assert.match(result, /> Native 인용\n>\s*\n> - 자식 목록\n>\s+1\. 손자 목록/);
  assert.match(result, /7\. 일곱\\\n {3}설명\n {3}- 하위 목록\n8\. 여덟\n\n다음 문단/);
  assert.equal(await notionMarkdown("> 인용\n\n\t- 자식\n밖", options), "> 인용\n>\n> - 자식\n\n밖\n");
});

test("블록 정규화는 native 인용·목록 안 fenced code와 escaped 리치 텍스트를 보존한다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  const source = "> 인용\n\t- 항목\n\t\t```md\n---\n**문자** <br> {literal}\n\t\t```\n밖\n\\*\\*의도한 별표\\*\\*와 `**코드**`\n| 항목 | 값 |\n| --- | --- |\n| 코드 | `a | b` |";
  const result = await notionMarkdown(source, options);
  assert.match(result, /> {3}```md\n> {3}---\n> {3}\*\*문자\*\* <br> \{literal\}\n> {3}```/);
  assert.match(result, /\n\n밖\n\n\\\*\\\*의도한 별표\\\*\\\*와 `\*\*코드\*\*`/);
  assert.match(result, /\| --- \| --- \|\n\| 코드 \| `a \\\| b` \|/);
});

test("Notion이 escape한 MDX 기호는 문자 참조 문자열로 노출하지 않고 리터럴로 보존한다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  assert.equal(await notionMarkdown(String.raw`\<tag> \{x\} \<br>`, options), "&lt;tag> &#123;x&#125; &lt;br>\n");
  assert.equal(await notionMarkdown(String.raw`\\\<tag>`, options), String.raw`\\&lt;tag>` + "\n");
  assert.equal(await notionMarkdown(String.raw`\<https://example.com>`, options), "&lt;https://example.com>\n");
  assert.equal(await notionMarkdown(String.raw`\<table>\<tr>\<td>문자\</td>\</tr>\</table>`, options),
    "&lt;table>&lt;tr>&lt;td>문자&lt;/td>&lt;/tr>&lt;/table>\n");
});

test("native child fence의 들여쓰기와 코드 본문 자체의 탭을 구분한다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  const result = await notionMarkdown("- 항목\n\t```text\n첫 줄\n\treturn value;\n  spaces\n\t```\n밖", options);
  assert.equal(result, "- 항목\n\n  ```text\n  첫 줄\n  \treturn value;\n    spaces\n  ```\n\n밖\n");
});

test("빈 줄 없는 Notion 구분선이 앞 문단을 Setext 제목으로 만들지 않게 정규화한다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  for (const newline of ["\n", "\r\n"]) {
    const source = ["## 마무리", "첫 문장", "감사합니다.", "---", "[원문](https://example.com/)", "", "다른 문단", "  ---  ", "끝"].join(newline);
    const expected = ["## 마무리", "첫 문장", "감사합니다.", "***", "[원문](https://example.com/)", "다른 문단", "  ***", "끝"].join(newline + newline);
    assert.equal(await notionMarkdown(source, options), `${expected}\n`);
  }
  assert.equal(await notionMarkdown("인용 앞\n> 인용 문단\n> ---\n> 다음 인용", options), "인용 앞\n\n> 인용 문단\n\n> ***\n\n> 다음 인용\n");
});

test("구분선 정규화는 코드·표·목록·리터럴 대시를 보존한다", async (t) => {
  const options = { workRoot: workspace(t), pageId: first, slugs: new Map() };
  const source = [
    "```markdown", "본문", "---", "```", "", "~~~~text", "---", "~~~~", "",
    "`---`", "", "| 항목 | 설명 |", "| --- | --- |", "| 값 | `---` |", "",
    "- --- -", "문장 속 --- 대시", "\\---", "", "> > 중첩 인용", "> > ---", "> > 이어지는 인용",
    "", "- 항목", "\t---", "", "본문", "- - -", "다음 문단",
  ].join("\n");
  const result = await notionMarkdown(source, options);
  assert.ok(result.includes("```markdown\n본문\n---\n```"));
  assert.ok(result.includes("~~~~text\n---\n~~~~"));
  assert.ok(result.includes("`---`"));
  assert.ok(result.includes("| 항목 | 설명 |\n| --- | --- |\n| 값 | `---` |"));
  assert.ok(result.includes("- --- -\n\n문장 속 --- 대시\n\n\\---"));
  assert.ok(result.includes("> > 중첩 인용\n\n> > ***\n\n> > 이어지는 인용"));
  assert.ok(result.includes("- 항목\n\n  ***\n\n본문\n\n- - -\n\n다음 문단"));
});

test("메타데이터와 같은 첫 H1만 제거하고 제목 서식·Unicode·공백을 표시 텍스트로 비교한다", async (t) => {
  const root = workspace(t);
  const options = { workRoot: root, pageId: first, slugs: new Map(), title: "새 글 제목" };
  const cases = [
    { markdown: "# 새 글 제목\n\n본문", expected: "\n본문\n" },
    { markdown: "# **새 글**   제목 ###\n\n본문", expected: "\n본문\n" },
    { markdown: "# `새 글` 제목\n\n본문", expected: "\n본문\n" },
    { markdown: `# ${"새 글 제목".normalize("NFD")}\n\n본문`, expected: "\n본문\n" },
    { markdown: "\uFEFF# 새 글 제목\r\n\r\n본문", expected: "\r\n본문\n" },
  ];

  for (const { markdown, expected } of cases) {
    assert.equal(await notionMarkdown(markdown, options), expected);
  }
});

test("첫 H1이 다른 제목이거나 첫 내용이 아니면 H1을 보존한다", async (t) => {
  const root = workspace(t);
  const options = { workRoot: root, pageId: first, slugs: new Map(), title: "새 글" };
  const cases = [
    "# 다른 글\n\n본문",
    "본문\n\n# 새 글",
    "## 소제목\n\n# 새 글",
    "    # 새 글\n\n본문",
    "제목 없음",
  ];

  for (const markdown of cases) {
    assert.equal(await notionMarkdown(markdown, options), `${markdown}\n`);
  }
  const noTitle = { workRoot: root, pageId: first, slugs: new Map() };
  assert.equal(await notionMarkdown("# 새 글\n\n본문", noTitle), "# 새 글\n\n본문\n");
});

test("메타데이터 제목의 일반 별표 문자를 지워 다른 제목과 같다고 판단하지 않는다", async (t) => {
  const root = workspace(t);
  const options = { workRoot: root, pageId: first, slugs: new Map(), title: "C*" };
  assert.equal(await notionMarkdown("# C\n\n본문", options), "# C\n\n본문\n");
});

test("제목 제거 뒤의 H1과 fenced code 안의 H1·escaped 별표를 그대로 둔다", async (t) => {
  const root = workspace(t);
  const options = { workRoot: root, pageId: first, slugs: new Map(), title: "새 글" };
  const markdown = "# 새 글\n\n# 뒤 제목\n\n```md\n# 새 글\n```\n\n\\*문자 그대로\\*";
  const result = await notionMarkdown(markdown, options);

  assert.equal(result, "\n# 뒤 제목\n\n```md\n# 새 글\n```\n\n\\*문자 그대로\\*\n");
});

test("첫 비어 있지 않은 줄이 코드 펜스이면 내부와 뒤의 같은 H1을 제거하지 않는다", async (t) => {
  const root = workspace(t);
  const options = { workRoot: root, pageId: first, slugs: new Map(), title: "새 글" };
  const markdown = "```md\n# 새 글\n```\n\n# 새 글";

  assert.equal(await notionMarkdown(markdown, options), `${markdown}\n`);
});

test("Notion 동기화가 메타데이터 제목을 본문 변환에 전달한다", async (t) => {
  const root = workspace(t);
  const prepared = await fetchNotionContent(root, config, api([page()], "# 새 글\n\n본문\n"));
  t.after(prepared.cleanup);

  assert.equal(prepared.posts[0]?.body, "\n본문\n");
});

test("callout·toggle를 텍스트로 변환하고 XML 미디어와 괄호가 있는 파일 URL도 저장한다", async (t) => {
  const root = workspace(t);
  const url = imageUrl.replace("example.png", "example(1).png");
  const result = await notionMarkdown(`<callout icon="💡">설명</callout>\n<details>\n<summary>토글</summary>\n내용\n</details>\n<image src="${url}"/>`, {
    workRoot: root, pageId: first, slugs: new Map(), fetcher: async () => new Response("image", { headers: { "content-type": "image/png" } }),
  });
  assert.match(result, /\*\*메모\*\*/);
  assert.match(result, /\*\*토글\*\*/);
  assert.match(result, /!\[\]\(\/post-assets\/notion\//);
});

test("미디어 다운로드는 인증 정보를 보내지 않고 내부 주소로의 리다이렉트·초과 파일을 거부한다", async (t) => {
  const root = workspace(t);
  await assert.rejects(downloadNotionFile(imageUrl, root, first, async (_, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), null);
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  }), /다운로드 실패/);
  await assert.rejects(downloadNotionFile(imageUrl, root, first, async () => new Response("bad", {
    headers: { "content-length": String(26 * 1024 * 1024) },
  })), /다운로드 실패/);
});

test("Notion 표를 GFM으로 바꾸고 셀 안의 코드와 파이프를 보존한다", async (t) => {
  const root = workspace(t);
  const result = await notionMarkdown('<table header-row="true">\n<tr><td>이름</td><td>코드</td></tr>\n<tr><td>A | B</td><td>`value | other`</td></tr>\n</table>', {
    workRoot: root, pageId: first, slugs: new Map(),
  });
  assert.match(result, /\| 이름 \| 코드 \|/);
  assert.ok(result.includes("A \\| B"));
  assert.ok(result.includes("`value \\| other`"));
});

test("Notion 설정이 없거나 폐기한 로컬 모드이면 즉시 실패한다", () => {
  assert.throws(() => notionConfig({}), /NOTION_TOKEN/);
  assert.throws(() => notionConfig({ NOTION_DATA_SOURCE_ID: dataSourceId }), /NOTION_TOKEN/);
  assert.throws(() => notionConfig({ ...config, CONTENT_SOURCE: "local" }), /파일 게시 모드는 제거/);
});

test("루트 환경파일은 process.env와 .env.local 우선순위를 보존한다", (t) => {
  const root = workspace(t);
  const keys = ["NOTION_ENV_TEST_EXISTING", "NOTION_ENV_TEST_LOCAL", "NOTION_ENV_TEST_BASE"];
  const original = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index];
  }));
  process.env.NOTION_ENV_TEST_EXISTING = "process";
  delete process.env.NOTION_ENV_TEST_LOCAL;
  delete process.env.NOTION_ENV_TEST_BASE;
  writeFileSync(path.join(root, ".env.local"), "NOTION_ENV_TEST_EXISTING=local\nNOTION_ENV_TEST_LOCAL=local\n");
  writeFileSync(path.join(root, ".env"), "NOTION_ENV_TEST_EXISTING=base\nNOTION_ENV_TEST_LOCAL=base\nNOTION_ENV_TEST_BASE=base\n");
  loadWorkspaceEnv(root);
  assert.deepEqual(keys.map((key) => process.env[key]), ["process", "local", "base"]);
});

test("실제 CLI 진입점은 불완전한 Notion 설정을 오류로 종료한다", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts"], {
    cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8",
    env: { ...process.env, CONTENT_SOURCE: "notion", NOTION_TOKEN: "", NOTION_DATABASE_ID: "", NOTION_DATA_SOURCE_ID: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOTION_TOKEN과 NOTION_DATA_SOURCE_ID/);
});

test("출력 교체 중 오류가 생기면 이미 바꾼 글·인덱스·에셋도 복원한다", async (t) => {
  const root = workspace(t);
  const content = await fetchNotionContent(root, config, api([page()], `## 이전 본문\n![이미지](${imageUrl})`));
  t.after(content.cleanup);
  const options = outputOptions(root);
  publish(root, content);
  const beforePost = readFileSync(path.join(root, "output/posts/new-post.mdx"), "utf8");
  const beforeIndex = readFileSync(options.publicPostIndexPath, "utf8");
  writeFileSync(path.join(root, "blocked"), "디렉터리가 아닌 파일");
  assert.throws(() => publishPosts(content.posts.map((post) => ({ ...post, body: "## 변경 본문" })), content.assetDir, {
    ...options, searchIndexPath: path.join(root, "blocked/search.json"),
  }));
  assert.equal(readFileSync(path.join(root, "output/posts/new-post.mdx"), "utf8"), beforePost);
  assert.equal(readFileSync(options.publicPostIndexPath, "utf8"), beforeIndex);
  assert.equal(readdirSync(path.join(root, "output/post-assets/notion", first)).length, 1);
  assert.equal(readdirSync(path.join(root, "output")).some((name) => name.startsWith(".publish-")), false);
});

test("본문의 실제 링크로 backlinks를 만들고 코드 예제의 링크는 인덱싱하지 않는다", async (t) => {
  const root = workspace(t);
  const mock = api([page(), page(second, "other-post")]);
  const content = await fetchNotionContent(root, config, async (url, init) => {
    if (url.includes(`/pages/${first}/markdown`)) return json({
      markdown: `[다른 글](https://www.notion.so/${second})\n\n\`[가짜](/posts/new-post/)\`\n`,
      truncated: false, unknown_block_ids: [],
    });
    return mock(url, init);
  });
  t.after(content.cleanup);
  publish(root, content);
  const links = JSON.parse(readFileSync(outputOptions(root).publicLinkIndexPath, "utf8"));
  assert.deepEqual(links.edges, [{ sourceSlug: "new-post", targetSlug: "other-post", kind: "none", label: "다른 글" }]);
  assert.doesNotMatch(JSON.stringify(links.nodes), new RegExp(first));
});

test("목차는 코드 예제를 제외하고 중복 제목과 MDX 문자 이스케이프를 처리한다", () => {
  const result = extractHeadings("## **제목**\n\n```ts\n## 코드일 뿐\n```\n\n### 제목\n\n## 값 &#123;T&#125;\n");
  assert.deepEqual(result, [
    { depth: 2, text: "제목", id: "제목" },
    { depth: 3, text: "제목", id: "제목-1" },
    { depth: 2, text: "값 {T}", id: "값-t" },
  ]);
});

test("Notion PDF·오디오·영상은 안전한 MDX 미디어로 게시한다", async (t) => {
  const root = workspace(t);
  const result = await notionMarkdown('<pdf src="https://example.com/guide.pdf">가이드</pdf>\n<video src="https://example.com/movie.mp4"/>\n<audio src="https://example.com/sound.mp3"/>', {
    workRoot: root, pageId: first, slugs: new Map(),
  });
  assert.match(result, /<iframe className="media-embed media-embed-pdf"/);
  assert.match(result, /<video className="media-embed media-embed-video" controls/);
  assert.match(result, /<audio className="media-embed media-embed-audio" controls/);
});

test("태그·시리즈 URL은 동기화에서 결정하고 빈값·충돌은 출력 전에 차단한다", async (t) => {
  const root = workspace(t);
  const content = await fetchNotionContent(root, config, api([page(), page(second, "other")]));
  t.after(content.cleanup);
  for (const field of ["tags", "series"] as const) {
    const collision = content.posts.map((post, index) => ({ ...post, [field]: field === "tags" ? [index ? "C#" : "C++"] : index ? "C#" : "C++" }));
    assert.throws(() => publishPosts(collision, content.assetDir, outputOptions(root)), /중복된 URL/);
    const empty = content.posts.map((post) => ({ ...post, [field]: field === "tags" ? ["+++"] : "+++" }));
    assert.throws(() => publishPosts(empty, content.assetDir, outputOptions(root)), /빈 URL/);
  }
  const entries = publishPosts(content.posts.map((post) => ({ ...post, tags: ["日本語", "한글"], series: "日本語" })), content.assetDir, outputOptions(root));
  assert.deepEqual(entries[0].tagSlugs, { 日本語: "日本語", 한글: "한글" });
  assert.equal(entries[0].seriesSlug, "日本語");
});
