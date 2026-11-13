import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { syncContent, verifySnapshot } from '../src/index.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-export-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'vault/blog');
  for (const dir of ['posts', 'notes', 'assets']) await fs.mkdir(path.join(sourceDir, dir), { recursive: true });
  const options = { sourceDir, contentDir: path.join(root, 'output/content'), assetsDir: path.join(root, 'output/assets') };
  const write = (file, source) => fs.writeFile(path.join(sourceDir, file), source);
  const read = (file) => fs.readFile(path.join(options.contentDir, file), 'utf8');
  const post = (extra = '', body = '공개 본문') => `---\npublish: true\ndate: 2026-11-12\nslug: hello\n${extra}---\n\n${body}\n`;
  return { root, options, write, read, post };
}

function codeValues(body) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body);
  const values = [];
  function walk(node) { if (['code', 'inlineCode'].includes(node.type)) values.push([node.type, node.value]); else node.children?.forEach(walk); }
  walk(tree); return values;
}

test('YAML boolean true인 글·메모만 내보내고 원본은 수정하지 않는다', async (t) => {
  const f = await fixture(t);
  await f.write('posts/한글 제목.md', f.post('tags: [React, React]\n'));
  await f.write('notes/짧은 기록.md', f.post('title: 메모 제목\n', '짧은 메모'));
  await f.write('posts/secret.md', '---\npublish: false\ndate: nonsense\ntags: broken\n---\nsecret text');
  await f.write('posts/string.md', '---\npublish: "true"\n---\nstring secret');
  await f.write('posts/missing.md', 'no properties secret');
  const before = await fs.readFile(path.join(f.options.sourceDir, 'posts/한글 제목.md'));
  const result = await syncContent(f.options);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.map((entry) => entry.kind).sort(), ['notes', 'posts']);
  const entry = result.entries.find((item) => item.kind === 'posts');
  assert.equal(entry.title, '한글 제목');
  assert.deepEqual(entry.tags, ['React']);
  assert.equal(entry.section, '기술');
  assert.equal(entry.summary, '공개 본문');
  assert(!JSON.stringify(result).includes('secret'));
  assert.deepEqual(await fs.readFile(path.join(f.options.sourceDir, 'posts/한글 제목.md')), before);
  assert.equal((await verifySnapshot(f.options)).entries.length, 2);
});

test('위키·상대 이미지와 첨부를 변환하고 참조 자산만 포함한다', async (t) => {
  const f = await fixture(t);
  await f.write('assets/photo.png', 'same image data');
  await f.write('assets/file.pdf', 'pdf data');
  await f.write('assets/private.png', 'never export');
  await f.write('posts/one.md', f.post('', '![[blog/assets/photo.png|360]]\n\n![화면|250x400](../assets/photo.png)\n\n[자료](../assets/file.pdf)'));
  const result = await syncContent(f.options);
  assert.equal(result.assets.length, 2);
  const text = await f.read('posts/hello.md');
  assert.match(text, /obsidian-size=360/);
  assert.match(text, /obsidian-size=250x400/);
  assert.match(text, /\/blog-assets\/[a-f0-9]{64}\.png/);
  assert.match(text, /\/blog-assets\/[a-f0-9]{64}\.pdf/);
  assert(!text.includes('blog/assets/'));
  assert(!JSON.stringify(result).includes('private.png'));
  assert.equal((await fs.readdir(f.options.assetsDir)).length, 2);
});

test('표 안의 이미지 크기 파이프를 열로 오해하지 않고 코드 예제를 보존한다', async (t) => {
  const f = await fixture(t);
  await f.write('assets/photo.png', 'image');
  const body = '| 화면 | 설명 |\n| --- | --- |\n| ![[blog/assets/photo.png|360x480]] | 그림 |\n\n```md\n![[blog/assets/does-not-exist.png|300]]\n[[비공개 노트]]\n```\n\n인라인 `![[blog/assets/also-missing.png|200]]` 문법';
  await f.write('posts/one.md', f.post('', body));
  await syncContent(f.options);
  const output = await f.read('posts/hello.md');
  assert.deepEqual(codeValues(output), codeValues(body));
  const tree = unified().use(remarkParse).use(remarkGfm).parse(output.split('---\n').slice(2).join('---\n'));
  const table = tree.children.find((node) => node.type === 'table');
  assert.equal(table.children[1].children.length, 2);
  assert.equal(table.children[1].children[0].children[0].type, 'image');
  assert.equal(table.children[1].children[0].children[0].title, 'obsidian-size=360x480');
});

test('공개 노트 링크만 주소로 연결하며 비공개 destination과 정의는 노출하지 않는다', async (t) => {
  const f = await fixture(t);
  await f.write('posts/one.md', f.post('', '[[notes/Public#한글 제목|공개 링크]]\n\n[공개](../notes/Public.md)\n\n[[notes/Private|비공개 별칭]]\n\n[숨김][secret]\n\n[secret]: ../notes/Private.md'));
  await f.write('notes/Public.md', f.post('title: 공개 메모\n', '메모'));
  await f.write('notes/Private.md', '---\npublish: false\nslug: ultra-secret\n---\nprivate content');
  await syncContent(f.options);
  const output = await f.read('posts/hello.md');
  assert.match(output, /\/notes\/hello\/#한글-제목/);
  assert.match(output, /\[공개\]\(\/notes\/hello\/\)/);
  assert.match(output, /비공개 별칭/);
  assert(!output.includes('Private') && !output.includes('ultra-secret') && !output.includes('[secret]:'));
});

test('링크 라벨의 인라인 코드와 사이트 절대 경로를 보존한다', async (t) => {
  const f = await fixture(t);
  const body = '[`공개 코드`](../notes/Public.md)\n\n[`비공개 코드`](../notes/Private.md)\n\n[소개](/about/)';
  await f.write('posts/one.md', f.post('', body));
  await f.write('notes/Public.md', f.post('', 'public'));
  await f.write('notes/Private.md', '---\npublish: false\n---\nsecret');
  await syncContent(f.options);
  const output = await f.read('posts/hello.md');
  assert.deepEqual(codeValues(output), codeValues(body));
  assert.match(output, /\[소개\]\(\/about\/\)/);
  assert(!output.includes('Private.md'));
});

test('공개→비공개 전환 시 문서와 그 첨부를 제거하고 빈 snapshot도 유효하다', async (t) => {
  const f = await fixture(t);
  await f.write('assets/photo.png', 'image');
  await f.write('notes/note.md', f.post('', '![[blog/assets/photo.png]]'));
  await syncContent(f.options);
  assert.equal((await fs.readdir(path.join(f.options.contentDir, 'notes'))).length, 1);
  await f.write('notes/note.md', '---\npublish: false\n---\n비공개');
  const result = await syncContent(f.options);
  assert.deepEqual(result.entries, []);
  assert.deepEqual(result.assets, []);
  assert.deepEqual(await fs.readdir(path.join(f.options.contentDir, 'notes')), []);
  assert.deepEqual(await fs.readdir(f.options.assetsDir), []);
  assert.equal((await verifySnapshot(f.options)).entries.length, 0);
});

test('공개 문서의 잘못된 날짜·속성·중복 slug는 실패하며 기존 snapshot을 보존한다', async (t) => {
  const f = await fixture(t);
  await f.write('posts/good.md', f.post());
  await syncContent(f.options);
  const previous = await f.read('export-manifest.json');
  await f.write('posts/bad.md', f.post('title: 중복\n'));
  await assert.rejects(syncContent(f.options), /중복/);
  assert.equal(await f.read('export-manifest.json'), previous);
  await f.write('posts/bad.md', '---\npublish: true\ndate: 2026-02-30\nslug: different\n---\ninvalid');
  await assert.rejects(syncContent(f.options), /날짜/);
  assert.equal(await f.read('export-manifest.json'), previous);
  await f.write('posts/bad.md', f.post('tags: nope\n').replace('slug: hello', 'slug: different'));
  await assert.rejects(syncContent(f.options), /tags/);
});

test('애매한 노트 이름은 폴더 경로 지정 없이 공개 링크를 만들지 않는다', async (t) => {
  const f = await fixture(t);
  await f.write('posts/one.md', f.post('', '[[Same]]'));
  await f.write('posts/Same.md', f.post().replace('slug: hello', 'slug: post-same'));
  await f.write('notes/Same.md', f.post().replace('slug: hello', 'slug: note-same'));
  await assert.rejects(syncContent(f.options), /여러 개/);
  await f.write('posts/one.md', f.post('', '[[notes/Same|메모]]'));
  await syncContent(f.options);
  assert.match(await f.read('posts/hello.md'), /\/notes\/note-same\//);
});

test('누락 첨부·경로 탈출·외부 symlink는 기존 snapshot을 바꾸지 않고 실패한다', async (t) => {
  const f = await fixture(t);
  await f.write('posts/one.md', f.post());
  await syncContent(f.options);
  const previous = await f.read('export-manifest.json');
  await f.write('posts/one.md', f.post('', '![[blog/assets/missing.png]]'));
  await assert.rejects(syncContent(f.options), /찾을 수 없습니다/);
  await fs.writeFile(path.join(f.root, 'outside.png'), 'secret');
  await f.write('posts/one.md', f.post('', '![](../../../outside.png)'));
  await assert.rejects(syncContent(f.options), /blog\/assets 안/);
  await fs.symlink(path.join(f.root, 'outside.png'), path.join(f.options.sourceDir, 'assets/link.png'));
  await f.write('posts/one.md', f.post('', '![[blog/assets/link.png]]'));
  await assert.rejects(syncContent(f.options), /blog\/assets 안/);
  await f.write('posts/one.md', f.post('', '![](file:///etc/passwd)'));
  await assert.rejects(syncContent(f.options), /로컬 첨부 경로/);
  assert.equal(await f.read('export-manifest.json'), previous);
});

test('명시된 원본 부재와 원본에 겹치는 출력 경로를 거부한다', async (t) => {
  const f = await fixture(t);
  await assert.rejects(syncContent({ ...f.options, sourceDir: undefined }), /OBSIDIAN_BLOG_DIR/);
  await assert.rejects(syncContent({ ...f.options, sourceDir: path.join(f.root, 'missing') }), /찾을 수 없습니다/);
  await assert.rejects(syncContent({ ...f.options, contentDir: path.join(f.options.sourceDir, 'generated') }), /겹칠 수 없습니다/);
});

test('두 출력 교체 중 실패하면 콘텐츠와 자산을 모두 이전 snapshot으로 복원한다', async (t) => {
  const f = await fixture(t);
  await f.write('posts/one.md', f.post());
  await syncContent(f.options);
  const previous = await f.read('export-manifest.json');
  await f.write('notes/new.md', f.post('', 'new note'));
  const rename = fs.rename;
  const realAssetsDir = await fs.realpath(f.options.assetsDir);
  fs.rename = async (from, to) => {
    if (from.includes('.obsidian-assets-') && to === realAssetsDir) throw new Error('simulated second output replacement failure');
    return rename(from, to);
  };
  try { await assert.rejects(syncContent(f.options), /simulated/); }
  finally { fs.rename = rename; }
  assert.equal(await f.read('export-manifest.json'), previous);
  assert.equal((await verifySnapshot(f.options)).entries.length, 1);
});

test('원본 없이 snapshot을 검증하며 부재·변조·추가 파일을 거부한다', async (t) => {
  const f = await fixture(t);
  await assert.rejects(verifySnapshot(f.options), /snapshot이 없습니다/);
  await f.write('posts/one.md', f.post());
  await syncContent(f.options);
  await fs.rm(f.options.sourceDir, { recursive: true });
  assert.equal((await verifySnapshot(f.options)).entries.length, 1);
  const original = await f.read('posts/hello.md');
  await fs.writeFile(path.join(f.options.contentDir, 'posts/hello.md'), original + '\nchanged');
  await assert.rejects(verifySnapshot(f.options), /해시가 다릅니다/);
  await fs.writeFile(path.join(f.options.contentDir, 'posts/hello.md'), original);
  await fs.writeFile(path.join(f.options.contentDir, 'posts/private.md'), 'private');
  await assert.rejects(verifySnapshot(f.options), /목록에 없는/);
});

test('첨부 변조·추가 첨부와 비공개 속성을 가진 snapshot을 거부한다', async (t) => {
  const f = await fixture(t);
  await f.write('assets/photo.png', 'image');
  await f.write('posts/one.md', f.post('', '![[blog/assets/photo.png]]'));
  const result = await syncContent(f.options);
  const asset = result.assets[0];
  await fs.writeFile(path.join(f.options.assetsDir, asset.file), 'changed');
  await assert.rejects(verifySnapshot(f.options), /첨부 파일 해시/);
  await fs.writeFile(path.join(f.options.assetsDir, asset.file), 'image');
  const file = path.join(f.options.contentDir, 'posts/hello.md');
  const source = (await fs.readFile(file, 'utf8')).replace('publish: true', 'publish: false');
  await fs.writeFile(file, source);
  result.entries[0].sha256 = createHash('sha256').update(source).digest('hex');
  await fs.writeFile(path.join(f.options.contentDir, 'export-manifest.json'), JSON.stringify(result));
  await assert.rejects(verifySnapshot(f.options), /비공개 문서/);
});
