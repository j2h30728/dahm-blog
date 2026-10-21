import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(appRoot, "../..");

test("uses the Next blog as the default public app", () => {
  const rootPackage = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));
  const appPackage = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));
  const vercelConfig = JSON.parse(readFileSync(path.join(workspaceRoot, "vercel.json"), "utf8"));

  assert.equal(rootPackage.scripts.dev, "pnpm sync:content && pnpm --filter @dahm-blog/blog dev");
  assert.equal(rootPackage.scripts["sync:content"], "pnpm --filter @dahm-blog/content-sync sync");
  assert.equal(rootPackage.scripts["build:blog"], "pnpm sync:content && pnpm --filter @dahm-blog/blog build");
  assert.equal(rootPackage.scripts.build, "pnpm --filter @dahm-blog/content-sync build && pnpm build:blog");
  assert.equal(rootPackage.scripts["sync:next-content"], undefined);
  assert.equal(rootPackage.scripts["build:next-blog"], undefined);
  assert.equal(rootPackage.scripts["test:next-blog"], undefined);
  assert.equal(rootPackage.scripts["typecheck:next-blog"], undefined);
  assert.equal(rootPackage.scripts["dev:next-blog"], undefined);
  assert.equal(appPackage.name, "@dahm-blog/blog");
  assert.equal(vercelConfig.framework, "nextjs");
  assert.equal(vercelConfig.buildCommand, "pnpm build:blog");
  assert.equal(vercelConfig.outputDirectory, "apps/blog/.next");
});

test("개발 서버는 일반 404 처리를 쓰고 운영 빌드만 정적 내보내기를 사용한다", async () => {
  const { default: config } = await import(pathToFileURL(path.join(appRoot, "next.config.mjs")).href);
  assert.equal(config("phase-development-server").output, undefined);
  assert.equal(config("phase-production-build").output, "export");
});

test("declares the public blog routes in App Router", () => {
  const routeFiles = [
    "src/app/page.tsx",
    "src/app/about/page.tsx",
    "src/app/tech/page.tsx",
    "src/app/life/page.tsx",
    "src/app/posts/index-view.tsx",
    "src/app/posts/[[...slug]]/page.tsx",
    "src/app/series/index-view.tsx",
    "src/app/series/[[...series]]/page.tsx",
    "src/app/tags/index-view.tsx",
    "src/app/tags/[[...tag]]/page.tsx",
    "src/app/rss.xml/route.ts",
    "src/app/robots.ts",
    "src/app/sitemap.ts",
  ];

  for (const routeFile of routeFiles) {
    assert.equal(existsSync(path.join(appRoot, routeFile)), true, `${routeFile} should exist`);
  }
});

test("전체 홈을 canonical로 사용하고 루트 리다이렉트 없이 분류 목록을 제공한다", () => {
  const vercelConfig = JSON.parse(readFileSync(path.join(workspaceRoot, "vercel.json"), "utf8"));
  const siteSource = readFileSync(path.join(appRoot, "src/lib/site.ts"), "utf8");
  const homeSource = readFileSync(path.join(appRoot, "src/app/page.tsx"), "utf8");
  const sitemapSource = readFileSync(path.join(appRoot, "src/app/sitemap.ts"), "utf8");
  const headerSource = readFileSync(path.join(appRoot, "src/components/SiteHeader.tsx"), "utf8");

  assert.equal((vercelConfig.redirects ?? []).some(redirect => redirect.source === "/"), false);
  assert.match(siteSource, /canonicalHomePath:\s*"\/"/);
  assert.match(homeSource, /canonicalPath\(siteConfig\.canonicalHomePath\)/);
  assert.match(sitemapSource, /pageEntry\(siteConfig\.canonicalHomePath/);
  assert.match(headerSource, /href="\/"/);
  for (const section of ["tech", "life"]) {
    const source = readFileSync(path.join(appRoot, `src/app/${section}/page.tsx`), "utf8");
    assert.match(source, new RegExp(`canonical: "/${section}/"`));
    assert.match(source, new RegExp(`category="${section}"`));
    assert.ok(sitemapSource.includes(`pageEntry("/${section}/"`));
  }
});

test("declares production-safe SEO URL generation", () => {
  const siteSource = readFileSync(path.join(appRoot, "src/lib/site.ts"), "utf8");
  const rssSource = readFileSync(path.join(appRoot, "src/lib/rss.ts"), "utf8");
  const layoutSource = readFileSync(path.join(appRoot, "src/app/layout.tsx"), "utf8");
  const postSource = readFileSync(path.join(appRoot, "src/app/posts/[[...slug]]/page.tsx"), "utf8");

  assert.match(siteSource, /PUBLIC_SITE_URL/);
  assert.match(siteSource, /VERCEL_ENV === "production"/);
  assert.match(siteSource, /NODE_ENV === "production"/);
  assert.match(siteSource, /REQUIRE_PUBLIC_SITE_URL === "true"/);
  assert.match(siteSource, /ALLOW_LOCAL_SITE_URL === "true"/);
  assert.doesNotMatch(`${siteSource}\n${rssSource}`, /example\.com/);
  assert.match(layoutSource, /metadataBase: new URL\(siteUrl\)/);
  assert.match(layoutSource, /"application\/rss\+xml": absoluteUrl\("\/rss\.xml"\)/);
  assert.match(postSource, /type="application\/ld\+json"/);
  assert.match(postSource, /"@type": "BlogPosting"/);
});

test("generates canonical SEO URLs with production guard", async () => {
  const site = await import(pathToFileURL(path.join(appRoot, "src/lib/site.ts")).href);

  assert.equal(site.getSiteUrl({ PUBLIC_SITE_URL: "https://dahm.example/" }), "https://dahm.example");
  assert.equal(site.absoluteUrl("/posts", { PUBLIC_SITE_URL: "https://dahm.example/" }), "https://dahm.example/posts/");
  assert.equal(site.absoluteUrl("/rss.xml", { PUBLIC_SITE_URL: "https://dahm.example/" }), "https://dahm.example/rss.xml");
  assert.equal(site.canonicalPath("/posts"), "/posts/");
  assert.equal(site.canonicalPath("/rss.xml"), "/rss.xml");
  assert.throws(() => site.canonicalPath("/posts/?q=seo"), /must not include query strings/);
  assert.throws(() => site.getSiteUrl({ NODE_ENV: "production" }), /PUBLIC_SITE_URL is required/);
  assert.equal(site.getSiteUrl({ NODE_ENV: "development" }), "http://localhost:3000");
});

test("Notion 생성물에 과거 파일 글과 폐기한 게시 경로가 남지 않는다", () => {
  const rootPackage = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));
  assert.equal(rootPackage.scripts["migrate:vault"], undefined);
  assert.equal(rootPackage.scripts["index:private"], undefined);
  assert.equal(rootPackage.scripts.postinstall, undefined);
  assert.equal(existsSync(path.join(workspaceRoot, "packages/private-wiki-index")), false);
  assert.equal(existsSync(path.join(workspaceRoot, "content/public/published")), false);
  const source = readFileSync(path.join(workspaceRoot, "packages/content-sync/src/notion-sync.ts"), "utf8");
  assert.doesNotMatch(source, /cpSync|readFileSync|parseNote|prepareNotionVault/);
});

test("uses generated content-sync artifacts for Next post routing", () => {
  const postIndexPath = path.join(appRoot, "src/content/public-post-index.json");
  const moduleMapPath = path.join(appRoot, "src/content/post-module-map.ts");

  assert.equal(existsSync(postIndexPath), true, "run sync:content before testing");
  assert.equal(existsSync(moduleMapPath), true, "run sync:content before testing");

  const postIndex = JSON.parse(readFileSync(postIndexPath, "utf8"));
  const moduleMap = readFileSync(moduleMapPath, "utf8");

  assert.equal(Array.isArray(postIndex.posts), true);
  const moduleSlugs = JSON.parse(moduleMap.match(/postModuleSlugs = (\[[^\n]*\]) as const;/)[1]);
  assert.deepEqual([...moduleSlugs].sort(), postIndex.posts.map((post) => post.slug).sort());

  for (const post of postIndex.posts) {
    assert.equal(typeof post.slug, "string");
    assert.ok(moduleMap.includes(`${JSON.stringify(post.slug)}: () => import(`));
  }
});
