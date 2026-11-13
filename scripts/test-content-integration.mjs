import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';
import { syncContent, verifySnapshot } from '../packages/content-sync/src/index.mjs';
import { root } from './content-environment.mjs';
import { serveStatic } from './test-support.mjs';

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'dahm-astro-integration-'));
const app = path.join(work, 'apps/blog');
const sourceDir = path.join(work, 'vault/blog');
const options = { sourceDir, contentDir: path.join(app, 'src/content'), assetsDir: path.join(app, 'public/blog-assets') };
const originalApp = path.join(root, 'apps/blog');
const { parse: parseYaml, stringify: stringifyYaml } = createRequire(new URL('../packages/content-sync/package.json', import.meta.url))('yaml');
let browser;
let server;
let dev;
let devLog = '';
const longTag = '공백과쉼표없이아주길게이어지는태그'.repeat(6);
const screenshots = process.env.BROWSER_ARTIFACT_DIR || path.join(root, '.playwright-mcp/tit');

function tagButton(page, tag) { return page.locator(`button[data-tit-tag=${JSON.stringify(tag)}]`); }
async function settlePage(page) {
  // ClientRouter changes the URL before its native view transition finishes.
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-astro-transition'));
}
async function assertTitState(page, slugs, { months, tag = '', query } = {}) {
  await waitFor(async () => {
    const visible = await page.locator('[data-post-card]').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => element.getAttribute('data-href')));
    return JSON.stringify(visible) === JSON.stringify(slugs.map(slug => `/notes/${slug}/`));
  }, () => `TIT rows do not match ${JSON.stringify(slugs)} at ${page.url()}`);
  assert.equal(await page.locator('[data-tit-archive] [data-result-count], .tit-filter-count').count(), 0, '메모 건수는 화면에 표시하지 않는다');
  assert.equal(await tagButton(page, tag).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-tit-tag][aria-pressed="true"]').count(), 1);
  if (months) {
    const visibleMonths = await page.locator('[data-tit-month]').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => element.getAttribute('data-tit-month')));
    assert.deepEqual(visibleMonths, months);
  }
  if (query !== undefined) assert.equal(new URL(page.url()).searchParams.get('q') || '', query);
  assert.equal(new URL(page.url()).searchParams.get('tag') || '', tag);
  assert.equal(await page.locator('[data-empty-state]').isVisible(), slugs.length === 0);
  await settlePage(page);
}

async function searchTit(page, query) {
  if (await page.locator('#site-search-form').isHidden()) await page.locator('[data-search-toggle]').click();
  await page.locator('#site-search').fill(query);
  await page.locator('#site-search').press('Enter');
}

async function verifyTitBrowser(page, url) {
  const all = ['month-boundary', 'fixture-note', 'filter-note', 'untagged-note', 'january-note', 'previous-year'];
  await page.goto(url + '/notes/', { waitUntil: 'networkidle' });
  await page.locator('[data-tit-archive]').waitFor();
  assert.equal(await page.locator('main h1').innerText(), '메모');
  assert.equal(await page.locator('nav[aria-label="주 메뉴"] a[href="/notes/"]').innerText(), '메모');
  await assertTitState(page, all, { months: ['2026-12', '2026-11', '2026-01', '2025-11'] });
  const listing = await page.locator('main').innerText();
  assert(!listing.includes('TIT_LIST_SUMMARY_HIDDEN'), 'TIT rows must not display summaries');
  assert(!listing.includes('PUBLIC_NOTE_BODY_SENTINEL'), 'TIT rows must not display note bodies');
  assert.match(await page.locator('[data-href="/notes/month-boundary/"]').innerText(), /12\.01/);
  assert.match(await page.locator('[data-tit-month="2025-11"]').innerText(), /2025/);
  assert.match(await page.locator('[data-tit-month="2026-11"]').innerText(), /2026/);
  assert.deepEqual(JSON.parse(await page.locator('[data-href="/notes/untagged-note/"]').getAttribute('data-tags')), []);

  // Exact matching: a comma in a tag is content, not a list separator.
  await page.evaluate(() => history.replaceState({ ...history.state, titTestMarker: 'preserved' }, '', location.href));
  await tagButton(page, 'React, hooks').click();
  await assertTitState(page, ['fixture-note', 'previous-year'], { months: ['2026-11', '2025-11'], tag: 'React, hooks' });
  assert.equal(await page.evaluate(() => history.state.titTestMarker), 'preserved');
  await searchTit(page, 'Fixture');
  await assertTitState(page, ['fixture-note'], { months: ['2026-11'], tag: 'React, hooks', query: 'Fixture' });
  await tagButton(page, 'React').click();
  await assertTitState(page, ['filter-note'], { months: ['2026-11'], tag: 'React', query: 'Fixture' });
  await tagButton(page, '').click();
  await assertTitState(page, ['fixture-note', 'filter-note'], { tag: '', query: 'Fixture' });
  await tagButton(page, 'React, hooks').click();
  await page.locator('[data-search-clear]').click();
  await assertTitState(page, ['fixture-note', 'previous-year'], { months: ['2026-11', '2025-11'], tag: 'React, hooks', query: '' });
  await searchTit(page, 'NO_MATCH_FOR_TIT_FILTER');
  await assertTitState(page, [], { months: [], tag: 'React, hooks', query: 'NO_MATCH_FOR_TIT_FILTER' });
  assert.match(await page.locator('[data-empty-state]').innerText(), /없/);

  // URL state is restored on direct entry, refresh, back/forward and detail return.
  const initial = '/notes/?' + new URLSearchParams({ q: 'Fixture', tag: 'React, hooks' });
  await page.goto(url + initial, { waitUntil: 'networkidle' });
  await assertTitState(page, ['fixture-note'], { tag: 'React, hooks', query: 'Fixture' });
  await page.reload({ waitUntil: 'networkidle' });
  await assertTitState(page, ['fixture-note'], { tag: 'React, hooks', query: 'Fixture' });
  await tagButton(page, 'React').click();
  await assertTitState(page, ['filter-note'], { tag: 'React', query: 'Fixture' });
  await page.goBack();
  await assertTitState(page, ['fixture-note'], { tag: 'React, hooks', query: 'Fixture' });
  await page.goForward();
  await assertTitState(page, ['filter-note'], { tag: 'React', query: 'Fixture' });
  await tagButton(page, '').click();
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page.locator('main a[href="/notes/fixture-note/"]').first().click();
  await page.waitForURL('**/notes/fixture-note/');
  await settlePage(page);
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin, 'TIT detail navigation should use ClientRouter');
  assert.match(await page.locator('main').innerText(), /메모/);
  assert.equal(await page.locator('nav[aria-label="주 메뉴"] a[aria-current="page"]').getAttribute('href'), '/notes/');
  assert.match(await page.locator('.content').innerText(), /PUBLIC_NOTE_BODY_SENTINEL/);
  await page.goBack();
  await assertTitState(page, ['fixture-note', 'filter-note'], { query: 'Fixture' });
  await tagButton(page, 'React, hooks').click();
  await assertTitState(page, ['fixture-note'], { tag: 'React, hooks', query: 'Fixture' });

  await page.goto(url + '/notes/?' + new URLSearchParams({ q: 'Fixture', tag: 'unknown-tag' }), { waitUntil: 'networkidle' });
  await assertTitState(page, ['fixture-note', 'filter-note'], { tag: '', query: 'Fixture' });
  for (let count = 0; count < 2; count++) {
    await page.locator('nav[aria-label="주 메뉴"] a[href="/posts/"]').click();
    await page.waitForURL('**/posts/');
    await settlePage(page);
    await page.locator('nav[aria-label="주 메뉴"] a[href="/notes/"]').click();
    await page.waitForURL('**/notes/');
    await assertTitState(page, all);
  }
  const historyLength = await page.evaluate(() => history.length);
  await tagButton(page, '태그 공백 포함').focus();
  await page.keyboard.press('Enter');
  await assertTitState(page, ['fixture-note', 'january-note'], { tag: '태그 공백 포함' });
  assert.equal(await page.evaluate(() => history.length), historyLength + 1, 'Re-entry must not duplicate filter listeners');
  await tagButton(page, '').focus();
  await page.keyboard.press('Space');
  await assertTitState(page, all);
  await page.screenshot({ path: path.join(screenshots, 'tit-desktop-light.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Long TIT titles/tags must wrap on mobile');
  await tagButton(page, longTag).click();
  await assertTitState(page, ['fixture-note'], { tag: longTag });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Selected long tag must not overflow');
  await tagButton(page, '').click();
  await assertTitState(page, all);
  await page.screenshot({ path: path.join(screenshots, 'tit-mobile-light.png'), fullPage: true });
  if (await page.locator('html').getAttribute('data-theme') !== 'dark') await page.locator('[data-theme-toggle]').click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(screenshots, 'tit-mobile-dark.png'), fullPage: true });
  await page.locator('nav[aria-label="주 메뉴"] a[href="/posts/"]').click();
  await page.waitForURL('**/posts/');
  await settlePage(page);
  await page.locator('nav[aria-label="주 메뉴"] a[href="/notes/"]').click();
  await page.waitForURL('**/notes/');
  await assertTitState(page, all);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(screenshots, 'tit-desktop-dark.png'), fullPage: true });
}

async function assertPostState(page, slugs, { category = 'all', query = '', pathname } = {}) {
  await waitFor(async () => {
    const visible = await page.locator('[data-post-card]').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => element.getAttribute('data-href')));
    return JSON.stringify(visible) === JSON.stringify(slugs.map(slug => `/posts/${slug}/`));
  }, () => `Post rows do not match ${JSON.stringify(slugs)} at ${page.url()}`);
  await settlePage(page);
  assert.equal(Number(await page.locator('[data-result-count]').textContent()), slugs.length);
  assert.equal(await page.locator('[data-post-category][aria-current="page"]').getAttribute('data-post-category'), category);
  assert.equal(await page.locator('nav[aria-label="주 메뉴"] a[aria-current="page"]').getAttribute('href'), '/posts/');
  assert.equal(new URL(page.url()).searchParams.get('q') || '', query);
  if (pathname) assert.equal(new URL(page.url()).pathname, pathname);
  assert.equal(await page.locator('[data-empty-state]').isVisible(), slugs.length === 0);
  for (const [name, count] of Object.entries({ all: 2, tech: 1, life: 1 })) {
    assert.equal(Number(await page.locator(`[data-category-count="${name}"]`).textContent()), count);
    const anchor = page.locator(`[data-post-category="${name}"]`);
    const href = new URL(await anchor.getAttribute('href'), page.url());
    assert.equal(href.pathname, { all: '/posts/', tech: '/tech/', life: '/life/' }[name]);
    assert.equal(href.searchParams.get('q') || '', query, 'Category links retain search in their real href');
  }
}

async function switchPostCategory(page, category) {
  await page.locator(`[data-post-category="${category}"]`).click();
  await page.waitForURL(url => url.pathname === { all: '/posts/', tech: '/tech/', life: '/life/' }[category]);
  await settlePage(page);
}

async function verifyPostCategories(page, url) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: 'networkidle' });
  assert.deepEqual(await page.locator('nav[aria-label="주 메뉴"] a:not([data-brand])').allTextContents().then(labels => labels.map(label => label.trim())), ['글', '메모', '소개']);
  await assertPostState(page, ['fixture-post', 'fixture-life'], { pathname: '/' });
  assert.equal(await page.locator('main a[href^="/notes/"]').count(), 0, 'Memo records are not mixed into the home post list');
  await page.locator('nav[aria-label="주 메뉴"] a[href="/posts/"]').click();
  await page.waitForURL('**/posts/');
  await assertPostState(page, ['fixture-post', 'fixture-life'], { pathname: '/posts/' });
  assert.equal(await page.locator('main h1').innerText(), '글');
  await searchTit(page, 'Fixture');
  await assertPostState(page, ['fixture-post', 'fixture-life'], { query: 'Fixture' });
  const origin = await page.evaluate(() => performance.timeOrigin);
  await switchPostCategory(page, 'tech');
  await assertPostState(page, ['fixture-post'], { category: 'tech', query: 'Fixture', pathname: '/tech/' });
  await switchPostCategory(page, 'life');
  await assertPostState(page, ['fixture-life'], { category: 'life', query: 'Fixture', pathname: '/life/' });
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin, 'Category links should keep ClientRouter navigation');
  await page.goBack();
  await assertPostState(page, ['fixture-post'], { category: 'tech', query: 'Fixture', pathname: '/tech/' });
  await page.goForward();
  await assertPostState(page, ['fixture-life'], { category: 'life', query: 'Fixture', pathname: '/life/' });
  await page.reload({ waitUntil: 'networkidle' });
  await assertPostState(page, ['fixture-life'], { category: 'life', query: 'Fixture', pathname: '/life/' });
  await page.locator('[data-search-clear]').click();
  await assertPostState(page, ['fixture-life'], { category: 'life', pathname: '/life/' });
  await page.locator('[data-post-category="tech"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/tech/');
  await assertPostState(page, ['fixture-post'], { category: 'tech' });
  await switchPostCategory(page, 'all');
  await searchTit(page, 'published');
  await assertPostState(page, ['fixture-post'], { query: 'published' });
  await switchPostCategory(page, 'life');
  await assertPostState(page, [], { category: 'life', query: 'published', pathname: '/life/' });
  assert.match(await page.locator('[data-empty-state]').innerText(), /없/);
  await page.locator('[data-search-clear]').click();
  await assertPostState(page, ['fixture-life'], { category: 'life', pathname: '/life/' });

  await page.locator('main a[href="/posts/fixture-life/"]').first().click();
  await page.waitForURL('**/posts/fixture-life/');
  await settlePage(page);
  assert.equal(await page.locator('nav[aria-label="주 메뉴"] a[aria-current="page"]').getAttribute('href'), '/posts/');
  assert.match(await page.locator('.content').innerText(), /PUBLIC_LIFE_BODY_SENTINEL/);
  await page.goBack();
  await assertPostState(page, ['fixture-life'], { category: 'life', pathname: '/life/' });
  await page.goto(url + '/posts/?category=life&q=Fixture', { waitUntil: 'networkidle' });
  await page.waitForURL(url => url.pathname === '/life/');
  await assertPostState(page, ['fixture-life'], { category: 'life', query: 'Fixture', pathname: '/life/' });
  assert.equal(new URL(page.url()).searchParams.has('category'), false);

  // Capture settled category layouts in both sizes and themes for visual review.
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('[data-theme-toggle]').click();
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
    await page.waitForTimeout(250);
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const [category, pathname, slugs] of [['all', '/posts/', ['fixture-post', 'fixture-life']], ['tech', '/tech/', ['fixture-post']], ['life', '/life/', ['fixture-life']]]) {
        await page.goto(url + pathname, { waitUntil: 'networkidle' });
        await assertPostState(page, slugs, { category, pathname });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${category} ${viewport.name} must not overflow`);
        await page.screenshot({ path: path.join(screenshots, `posts-${category}-${viewport.name}-${theme}.png`), fullPage: true });
      }
    }
  }
}

async function waitFor(check, message) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* Server/config may be restarting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(typeof message === 'function' ? message() : message);
}

async function startDev() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  // Run the real root dev command in an isolated workspace so fs.watch is tested too.
  await fs.mkdir(path.join(work, 'scripts'), { recursive: true });
  for (const name of ['dev.mjs', 'content-environment.mjs', 'prepare-content.mjs']) await fs.copyFile(path.join(root, 'scripts', name), path.join(work, 'scripts', name));
  const pipeline = path.join(work, 'packages/content-sync');
  await fs.mkdir(pipeline, { recursive: true });
  await fs.cp(path.join(root, 'packages/content-sync/src'), path.join(pipeline, 'src'), { recursive: true });
  await fs.copyFile(path.join(root, 'packages/content-sync/package.json'), path.join(pipeline, 'package.json'));
  await fs.symlink(path.join(root, 'packages/content-sync/node_modules'), path.join(pipeline, 'node_modules'), 'dir');
  const rootPackage = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(work, 'package.json'), JSON.stringify({ name: 'dahm-dev-fixture', private: true, type: 'module', packageManager: rootPackage.packageManager }));
  await fs.writeFile(path.join(work, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
  const appPackage = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
  appPackage.scripts.dev = `astro dev --host 127.0.0.1 --port ${port}`;
  await fs.writeFile(path.join(app, 'package.json'), JSON.stringify(appPackage));
  dev = spawn(process.execPath, [path.join(work, 'scripts/dev.mjs')], {
    cwd: work, detached: true, env: { ...process.env, OBSIDIAN_BLOG_DIR: sourceDir, PUBLIC_SITE_URL: 'https://example.test', GISCUS_ENABLED: 'false', VERCEL_ENV: 'preview' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  dev.stdout.on('data', data => { devLog += data; });
  dev.stderr.on('data', data => { devLog += data; });
  const url = `http://127.0.0.1:${port}`;
  await waitFor(async () => (await fetch(url + '/notes/', { signal: AbortSignal.timeout(1500) })).ok, () => `Fixture dev server did not start (exit ${dev.exitCode}): ${devLog}`);
  return url;
}

async function runPnpm(args) {
  await new Promise((resolve, reject) => {
    const executable = process.env.npm_execpath;
    const nativePnpm = executable && /pnpm\.(?:c?js|mjs)$/.test(executable);
    const child = spawn(nativePnpm ? process.execPath : 'pnpm', nativePnpm ? [executable, '--dir', app, ...args] : ['--dir', app, ...args], { env: { ...process.env, PUBLIC_SITE_URL: 'https://example.test', GISCUS_ENABLED: 'false', VERCEL_ENV: 'preview' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Fixture command ${args.join(' ')} failed (${code}):\n${output}`)));
  });
}
async function build() { await runPnpm(['build']); }
async function allText(directory) {
  let text = '';
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) text += await allText(file);
    else if (/\.(?:html|xml|json|txt|js)$/.test(entry.name)) text += await fs.readFile(file, 'utf8');
  }
  return text;
}

try {
  await fs.mkdir(screenshots, { recursive: true });
  await fs.cp(originalApp, app, { recursive: true, filter: file => {
    const relative = path.relative(originalApp, file).split(path.sep).join('/');
    return !['node_modules', 'dist', '.astro', 'src/content', 'public/blog-assets', 'public/og/posts'].some(skip => relative === skip || relative.startsWith(skip + '/'));
  } });
  // A real isolated dependency tree avoids Astro virtual-module paths crossing a symlinked root.
  const packageJson = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
  packageJson.packageManager = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).packageManager;
  await fs.writeFile(path.join(app, 'package.json'), JSON.stringify(packageJson, null, 2));
  const lock = parseYaml(await fs.readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'));
  lock.importers = { '.': lock.importers['apps/blog'] };
  await fs.writeFile(path.join(app, 'pnpm-lock.yaml'), stringifyYaml(lock));
  await runPnpm(['install', '--offline', '--frozen-lockfile', '--ignore-scripts']);
  for (const directory of ['posts', 'notes', 'assets']) await fs.mkdir(path.join(sourceDir, directory), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'assets/public.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jdxkAAAAASUVORK5CYII=', 'base64'));
  await fs.writeFile(path.join(sourceDir, 'assets/note.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="green"/></svg>');
  await fs.writeFile(path.join(sourceDir, 'assets/private.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_ATTACHMENT_SENTINEL</text></svg>');
  const publicPost = `---\ntitle: Fixture published post\npublish: true\ndate: 2026-11-12\nslug: fixture-post\nsection: 기술\ntags: [fixture]\n---\n\n# Published article\n\nPUBLIC_POST_BODY_SENTINEL\n\n![[blog/assets/public.png|120]]\n\n[[notes/public-note|Open public note]]\n\n[[notes/private-note|Private reference label]]\n`;
  const lifePost = `---\ntitle: Fixture life post\npublish: true\ndate: 2026-11-11\nslug: fixture-life\nsection: 일상\ntags: [fixture]\n---\n\nPUBLIC_LIFE_BODY_SENTINEL\n`;
  const publicNote = `---\ntitle: Fixture public note\npublish: true\ndate: 2026-11-12\nslug: fixture-note\ntags: ${JSON.stringify(['topic-fixture', 'React, hooks', '태그 공백 포함', longTag])}\n---\n\nPUBLIC_NOTE_BODY_SENTINEL\n\n![[blog/assets/note.svg|160x80]]\n`;
  const extraNotes = [
    { slug: 'month-boundary', title: '한국 시간 월 경계 기록', date: '2026-11-30T16:30:00Z', tags: ['boundary'] },
    { slug: 'filter-note', title: 'Fixture filtering note', date: '2026-11-08', tags: ['topic-fixture', 'React'] },
    { slug: 'untagged-note', title: '태그가 없는 기록과 모바일에서 자연스럽게 줄바꿈되어야 하는 아주 긴 제목 '.repeat(4).trim(), date: '2026-11-05', tags: [] },
    { slug: 'january-note', title: '겨울 코드 조각', date: '2026-01-01', tags: ['태그 공백 포함'] },
    { slug: 'previous-year', title: '작년 회고 메모', date: '2025-11-12', tags: ['React, hooks'] },
  ].map(note => ({ ...note, source: `---\ntitle: ${JSON.stringify(note.title)}\npublish: true\ndate: ${note.date}\nslug: ${note.slug}\ntags: ${JSON.stringify(note.tags)}\nsummary: TIT_LIST_SUMMARY_HIDDEN_${note.slug}\n---\n\nTIT_BODY_${note.slug}\n` }));
  const privateNote = `---\ntitle: PRIVATE_NOTE_TITLE_SENTINEL\npublish: false\nslug: private-note\n---\n\nPRIVATE_NOTE_BODY_SENTINEL\n\n![[blog/assets/private.svg]]\n`;
  await fs.writeFile(path.join(sourceDir, 'posts/public-post.md'), publicPost);
  await fs.writeFile(path.join(sourceDir, 'posts/life-post.md'), lifePost);
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote);
  await fs.writeFile(path.join(sourceDir, 'notes/private-note.md'), privateNote);
  for (const note of extraNotes) await fs.writeFile(path.join(sourceDir, `notes/${note.slug}.md`), note.source);
  const first = await syncContent(options);
  assert.equal(first.entries.length, 8);
  assert.equal(first.assets.length, 2);
  await verifySnapshot(options);
  await build();
  const output = await allText(path.join(app, 'dist'));
  for (const sentinel of ['PRIVATE_NOTE_TITLE_SENTINEL', 'PRIVATE_NOTE_BODY_SENTINEL', 'PRIVATE_ATTACHMENT_SENTINEL']) assert.ok(!output.includes(sentinel), `Private content leaked: ${sentinel}`);
  assert.ok(output.includes('PUBLIC_NOTE_BODY_SENTINEL'));
  const noteHtml = await fs.readFile(path.join(app, 'dist/notes/fixture-note/index.html'), 'utf8');
  assert.match(noteHtml, /width="160"/);
  assert.match(noteHtml, /height="80"/);
  assert.ok(!noteHtml.includes('obsidian-size='), 'Internal size marker must not be shown');
  assert.ok((await fs.readFile(path.join(app, 'dist/rss.xml'), 'utf8')).includes('/notes/fixture-note/'));
  assert.ok((await fs.readFile(path.join(app, 'dist/sitemap.xml'), 'utf8')).includes('/notes/fixture-note/'));

  server = await serveStatic(path.join(app, 'dist'));
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await verifyTitBrowser(page, server.url);
  await verifyPostCategories(page, server.url);
  await page.goto(server.url + '/notes/', { waitUntil: 'networkidle' });
  await page.locator('[data-search-toggle]').click();
  await page.locator('#site-search').fill('Fixture public note');
  await page.locator('#site-search').press('Enter');
  await page.waitForTimeout(350);
  assert.ok((await page.locator('main').innerText()).includes('Fixture public note'));
  assert.deepEqual(browserErrors, [], 'Section and memo browser runtime errors');
  await browser.close(); browser = undefined;
  await server.close(); server = undefined;

  // A previously public note must disappear from all generated surfaces after being unpublished.
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote.replace('publish: true', 'publish: false'));
  for (const note of extraNotes) await fs.writeFile(path.join(sourceDir, `notes/${note.slug}.md`), note.source.replace('publish: true', 'publish: false'));
  const second = await syncContent(options);
  assert.equal(second.entries.length, 2);
  assert.equal(second.assets.length, 1);
  await build();
  await assert.rejects(fs.stat(path.join(app, 'dist/notes/fixture-note/index.html')), /ENOENT/);
  const unpublished = await allText(path.join(app, 'dist'));
  assert.ok(!unpublished.includes('PUBLIC_NOTE_BODY_SENTINEL'));
  assert.ok(!unpublished.includes('Fixture public note'));
  assert.ok(!(await fs.readFile(path.join(app, 'dist/rss.xml'), 'utf8')).includes('/notes/fixture-note/'));
  assert.ok(!(await fs.readFile(path.join(app, 'dist/sitemap.xml'), 'utf8')).includes('/notes/fixture-note/'));
  // The running Astro server must discover a formerly empty notes collection without manual restart.
  const devUrl = await startDev();
  assert.ok(!(await (await fetch(devUrl + '/notes/')).text()).includes('href="/notes/fixture-note/"'));
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote);
  await waitFor(async () => (await (await fetch(devUrl + '/notes/')).text()).includes('href="/notes/fixture-note/"'), () => `Astro dev did not discover newly published note:\n${devLog}`);
  await waitFor(async () => (await (await fetch(devUrl + '/notes/fixture-note/')).text()).includes('PUBLIC_NOTE_BODY_SENTINEL'), 'Astro dev note detail did not update');
  await fs.writeFile(path.join(sourceDir, 'notes/public-note.md'), publicNote.replace('publish: true', 'publish: false'));
  await waitFor(async () => !(await (await fetch(devUrl + '/notes/')).text()).includes('Fixture public note'), 'Astro dev did not remove unpublished note');
  console.log(JSON.stringify({ publicNote: 'listing/detail/search/RSS/sitemap passed', memo: 'KST month/year grouping, exact tags + query AND, counts/empty months/aria, URL/reload/history/detail/ClientRouter re-entry, keyboard/mobile/dark passed', postCategories: 'posts-only home/all, tech/life tabs and counts, query preservation, clear/current scope, history/reload/detail/legacy redirect and desktop/mobile/dark passed', screenshots, noteDimensions: '160x80 passed', privateContent: 'excluded', unpublish: 'route/search/RSS/sitemap/assets pruned', devCollectionUpdates: 'empty → published → private passed', source: 'isolated fixture; real vault untouched' }));
} finally {
  if (dev?.pid) {
    try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* Already exited. */ }
    await new Promise(resolve => dev.exitCode !== null ? resolve() : dev.once('exit', resolve));
  }
  if (browser) await browser.close();
  if (server) await server.close();
  await fs.rm(work, { recursive: true, force: true });
}
