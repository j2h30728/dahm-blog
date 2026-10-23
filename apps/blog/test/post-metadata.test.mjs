import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function dataModule(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function compileModule(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const code = outputText.replace(/from "([^"]+)"/g, (_, name) =>
    `from ${JSON.stringify(imports[name] ?? (name.startsWith("node:") ? name : pathToFileURL(require.resolve(name)).href))}`);
  return dataModule(code);
}

const postsModule = await import(compileModule("../src/lib/posts.ts", {
  "../content/public-post-index.json": dataModule("export default { posts: [] }"),
  "../content/post-module-map": dataModule("export const postModules = {}; export const postModuleSlugs = []"),
  "./route-segment": dataModule("export const decodeRouteSegment = value => value"),
}));

const siteStub = dataModule(`
  export const siteConfig = { name: "Dahm", description: "설명", language: "ko" };
  export const getSiteUrl = () => "https://dahm.test";
  export const absoluteUrl = path => new URL(path, "https://dahm.test").toString();
`);
const { renderRssFeed } = await import(compileModule("../src/lib/rss.ts", { "./site": siteStub }));

test("날짜 전용 발행일은 실행 환경의 시간대와 무관하게 같은 달력 날짜로 표시한다", () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Seoul", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      assert.equal(postsModule.formatPostDate("2026-05-10"), "May 10, 2026", timezone);
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("RSS 채널 갱신일은 발행일과 수정일 전체에서 가장 최신 날짜를 사용한다", () => {
  const posts = [
    post({ slug: "first", date: "2026-01-01", updated: "2026-02-03T12:00:00.000Z" }),
    post({ slug: "second", date: "2026-03-04" }),
    post({ slug: "third", date: "2026-02-01", updated: "2026-04-05T06:07:08.000Z" }),
  ];
  const rss = renderRssFeed(posts, "https://dahm.test");

  assert.match(rss, /<lastBuildDate>Sun, 05 Apr 2026 06:07:08 GMT<\/lastBuildDate>/);
});

test("RSS 갱신일은 수정일이 없거나 발행일이 더 최신인 글도 보존하고 항목 pubDate·guid는 바꾸지 않는다", () => {
  const posts = [
    post({ slug: "updated", date: "2026-01-01", updated: "2026-02-01T00:00:00.000Z" }),
    post({ slug: "published-later", date: "2026-03-04" }),
  ];
  const rss = renderRssFeed(posts, "https://dahm.test");

  assert.match(rss, /<lastBuildDate>Wed, 04 Mar 2026 00:00:00 GMT<\/lastBuildDate>/);
  assert.match(rss, /<pubDate>Thu, 01 Jan 2026 00:00:00 GMT<\/pubDate>/);
  assert.match(rss, /<guid>https:\/\/dahm\.test\/posts\/updated\/<\/guid>/);
});

test("빈 RSS 피드는 현재 시각을 유효한 lastBuildDate로 유지한다", () => {
  const before = Date.now();
  const rss = renderRssFeed([], "https://dahm.test");
  const after = Date.now();
  const value = rss.match(/<lastBuildDate>(.*?)<\/lastBuildDate>/)?.[1];
  assert.ok(value);
  assert.ok(Date.parse(value) >= before - 1_000 && Date.parse(value) <= after + 1_000);
});

function post({ slug, date, updated }) {
  return {
    slug,
    href: `/posts/${slug}/`,
    title: slug,
    description: `${slug} 설명`,
    date,
    ...(updated ? { updated } : {}),
    tags: ["Frontend"],
  };
}
