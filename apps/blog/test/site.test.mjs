import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSiteUrl, canonicalPath, jsonLd } from '../src/lib/site.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const manifest = JSON.parse(await readFile(path.join(root, 'src/content/export-manifest.json'), 'utf8'));
const htmlFor = href => readFile(path.join(dist, decodeURIComponent(href), 'index.html'), 'utf8');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

test('canonical URL generation requires an explicit production origin', () => {
  assert.throws(() => getSiteUrl({ NODE_ENV: 'production' }), /PUBLIC_SITE_URL/);
  assert.equal(getSiteUrl({ NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.equal(getSiteUrl({ NODE_ENV: 'production', ALLOW_LOCAL_SITE_URL: 'true' }), 'http://localhost:3000');
  assert.throws(() => getSiteUrl({ NODE_ENV: 'production', VERCEL_ENV: 'production', ALLOW_LOCAL_SITE_URL: 'true' }), /PUBLIC_SITE_URL/);
  assert.throws(() => getSiteUrl({ ALLOW_LOCAL_SITE_URL: 'true', REQUIRE_PUBLIC_SITE_URL: 'true' }), /PUBLIC_SITE_URL/);
  assert.equal(getSiteUrl({ PUBLIC_SITE_URL: 'https://example.com/path' }), 'https://example.com');
  assert.equal(canonicalPath('/notes/hello'), '/notes/hello/');
  assert.throws(() => canonicalPath('/?q=hello'));
  assert.ok(!jsonLd({ value: '</script>' }).includes('</script>'));
});

test('all public posts and notes have static detail pages, metadata and RSS entries', async () => {
  const rss = await readFile(path.join(dist, 'rss.xml'), 'utf8');
  const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
  for (const entry of manifest.entries) {
    const html = await htmlFor(entry.href);
    assert.ok(html.includes(escape(entry.title)), entry.href);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /property="og:type" content="article"/);
    assert.match(html, /application\/ld\+json/);
    assert.ok(sitemap.includes(escape(entry.href)), entry.href);
    assert.ok(rss.includes(escape(entry.href)), entry.href);
    await access(path.join(dist, 'og', entry.kind, `${entry.slug}.png`));
  }
  assert.equal((rss.match(/<item>/g) ?? []).length, manifest.entries.length);
});

test('home contains the entire public collection and a notes menu', async () => {
  const home = await htmlFor('/');
  assert.equal((home.match(/data-post-card/g) ?? []).length, manifest.entries.length);
  assert.match(home, /href="\/notes\/"/);
  assert.match(home, /name="twitter:card" content="summary"/);
  assert.doesNotMatch(home, /property="og:image"/);
  assert.doesNotMatch(home, /_next\/|react-dom|react\/jsx/);
});

test('notes archive supports an empty collection without rendering private content', async () => {
  const notes = manifest.entries.filter(entry => entry.kind === 'notes');
  const html = await htmlFor('/notes/');
  assert.equal((html.match(/data-post-card/g) ?? []).length, notes.length);
  if (!notes.length) assert.match(html, /아직 공개된 메모가 없습니다/);
  for (const entry of notes) assert.ok(html.includes(escape(entry.title)));
});

test('images reference exported assets and never expose Obsidian size markers', async () => {
  for (const entry of manifest.entries) {
    const html = await htmlFor(entry.href);
    assert.doesNotMatch(html, /title="obsidian-size=/);
    assert.doesNotMatch(html, /!\[\[blog\/assets\//);
    for (const match of html.matchAll(/<img\b[^>]*src="(\/blog-assets\/[^"#?]+)"/g)) {
      await access(path.join(dist, decodeURIComponent(match[1])));
    }
  }
});

test('legacy generated directories are absent from deployed output', async () => {
  const files = await readdir(dist);
  for (const name of ['_next', 'post-assets', 'search']) assert.ok(!files.includes(name), name);
});
