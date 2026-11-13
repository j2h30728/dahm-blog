import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument, stringify as stringifyYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { toString } from 'mdast-util-to-string';
import { slug as headingSlug } from 'github-slugger';

const parser = unified().use(remarkParse).use(remarkGfm);
const writer = unified().use(remarkStringify, { bullet: '-', fences: true, listItemIndent: 'one' }).use(remarkGfm);
const kinds = ['posts', 'notes'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inside = (base, candidate) => candidate === base || candidate.startsWith(base + path.sep);
const normalized = (value) => value.normalize('NFC');
const fail = (message) => { throw new Error(message); };

function parseFrontmatter(source, label) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) return { data: {}, body: source };
  const document = parseDocument(match[1], { uniqueKeys: true, maxAliasCount: 0 });
  if (document.errors.length) fail(`YAML 속성 오류: ${label}: ${document.errors[0].message}`);
  const data = document.toJS({ maxAliasCount: 0 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(`속성은 객체여야 합니다: ${label}`);
  return { data, body: source.slice(match[0].length) };
}

function validSlug(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`slug가 비어 있습니다: ${label}`);
  const result = normalized(value.trim());
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}._-]*$/u.test(result) || result === '.' || result === '..') {
    fail(`slug는 문자·숫자·점·밑줄·하이픈으로 된 단일 경로여야 합니다: ${label}`);
  }
  return result;
}

function validDate(value, label) {
  if (value instanceof Date) value = value.toISOString();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) {
    fail(`공개 문서에 유효한 date가 필요합니다: ${label}`);
  }
  // Date.parse accepts impossible dates such as February 30; reject them.
  if (new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10) && !value.includes('T')) {
    fail(`실제 달력에 없는 날짜입니다: ${label}`);
  }
  return value.includes('T') ? new Date(value).toISOString() : value;
}

function plainSummary(body) {
  const tree = parser.parse(body);
  function withoutCode(node) {
    if (['code', 'inlineCode', 'image', 'imageReference', 'html'].includes(node.type)) return null;
    return node.children ? { ...node, children: node.children.map(withoutCode).filter(Boolean) } : node;
  }
  return toString(withoutCode(tree)).replace(/!\[\[[^\]]+\]\]|\[\[[^\]]+\]\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function metadata(document) {
  const { data, file, kind, body } = document;
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : path.basename(file, '.md');
  const fallback = path.basename(file, '.md').normalize('NFC').replace(/[^\p{L}\p{N}\p{M}._-]+/gu, '-').replace(/^-+|-+$/g, '');
  const slug = validSlug(data.slug || fallback, document.relative);
  const date = validDate(data.date, document.relative);
  if (data.tags != null && (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string'))) {
    fail(`tags는 문자열 목록이어야 합니다: ${document.relative}`);
  }
  if (data.summary != null && typeof data.summary !== 'string') fail(`summary는 문자열이어야 합니다: ${document.relative}`);
  const result = {
    publish: true, title, slug, date,
    ...(kind === 'posts' ? { section: data.section || '기술' } : {}),
    tags: [...new Set((data.tags || []).map((tag) => tag.trim()).filter(Boolean))],
    summary: data.summary?.trim() || plainSummary(body),
  };
  if (kind === 'posts' && !['기술', '일상'].includes(result.section)) fail(`section은 기술 또는 일상이어야 합니다: ${document.relative}`);
  if (data.updated) result.updated = validDate(data.updated, document.relative);
  if (data.series) {
    if (typeof data.series !== 'string') fail(`series는 문자열이어야 합니다: ${document.relative}`);
    result.series = data.series.trim();
  }
  if (data.seriesOrder != null) {
    if (typeof data.seriesOrder !== 'number' || !Number.isFinite(data.seriesOrder)) fail(`seriesOrder는 숫자여야 합니다: ${document.relative}`);
    result.seriesOrder = data.seriesOrder;
  }
  return result;
}

async function readDocuments(sourceDir) {
  const documents = [];
  for (const kind of kinds) {
    const directory = path.join(sourceDir, kind);
    const stat = await fs.lstat(directory).catch(() => fail(`Obsidian ${kind} 폴더가 없습니다: ${directory}`));
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`문서 폴더는 실제 디렉터리여야 합니다: ${directory}`);
    async function walk(current) {
      for (const entry of (await fs.readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.')) continue;
        const file = path.join(current, entry.name);
        if (entry.isSymbolicLink()) fail(`문서 경로에 symlink를 사용할 수 없습니다: ${file}`);
        if (entry.isDirectory()) { await walk(file); continue; }
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
        const relative = path.relative(sourceDir, file).split(path.sep).join('/');
        const original = await fs.readFile(file, 'utf8');
        const parsed = parseFrontmatter(original, relative);
        documents.push({ ...parsed, original, file, relative, kind, published: parsed.data.publish === true });
      }
    }
    await walk(directory);
  }
  return documents;
}

function referenceIndex(documents) {
  const index = new Map();
  for (const document of documents) {
    const relative = document.relative.replace(/\.md$/i, '');
    const references = [relative, path.basename(relative), ...(typeof document.data.slug === 'string' ? [document.data.slug, `${document.kind}/${document.data.slug}`] : [])];
    for (const reference of new Set(references.map(normalized))) {
      index.set(reference, [...new Set([...(index.get(reference) || []), document])]);
    }
  }
  return index;
}

function decodeReference(value, label) {
  try { return normalized(decodeURIComponent(value)); }
  catch { fail(`올바르지 않은 URL 인코딩입니다: ${label}`); }
}

function splitTarget(target) {
  const hashAt = target.indexOf('#');
  return hashAt === -1 ? [target, ''] : [target.slice(0, hashAt), target.slice(hashAt + 1)];
}

function codeRanges(tree) {
  const ranges = [];
  function walk(node) {
    if (['code', 'inlineCode'].includes(node.type)) ranges.push([node.position.start.offset, node.position.end.offset]);
    else node.children?.forEach(walk);
  }
  walk(tree);
  return ranges;
}

function protectWikilinks(body) {
  const ranges = codeRanges(parser.parse(body));
  const tokens = new Map();
  let masked = '', offset = 0;
  for (const match of body.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
    if (ranges.some(([start, end]) => match.index >= start && match.index < end)) continue;
    // Explicitly escaped wikilinks are prose, not export directives.
    let escapes = 0;
    for (let i = match.index - 1; i >= 0 && body[i] === '\\'; i--) escapes++;
    if (escapes % 2) continue;
    const token = `OBSIDIANEXPORTTOKEN${tokens.size}ENDTOKEN`;
    if (body.includes(token)) fail('원문이 내부 변환 토큰과 충돌합니다.');
    tokens.set(token, { embed: match[1] === '!', value: match[2] });
    masked += body.slice(offset, match.index) + token;
    offset = match.index + match[0].length;
  }
  return { masked: masked + body.slice(offset), tokens };
}

async function transformBody(document, context) {
  const { sourceDir, assetSource, index, assets, stageAssets } = context;
  const { masked, tokens } = protectWikilinks(document.body);
  const tree = parser.parse(masked);

  function documentLink(target, label) {
    const [unparsed, anchor] = splitTarget(decodeReference(target, document.relative));
    let reference = unparsed.replace(/\.md$/i, '');
    if (reference.startsWith('blog/')) reference = reference.slice(5);
    const references = [];
    if (!reference) references.push(document);
    if (reference.startsWith('../') || reference.startsWith('./')) {
      const resolved = path.resolve(path.dirname(document.file), reference);
      if (!inside(sourceDir, resolved)) fail(`노트 링크가 blog 폴더 밖을 가리킵니다: ${document.relative}`);
      references.push(...(index.get(normalized(path.relative(sourceDir, resolved).split(path.sep).join('/'))) || []));
    } else references.push(...(index.get(normalized(reference)) || []));
    const unique = [...new Set(references)];
    if (unique.length > 1) fail(`같은 이름의 노트가 여러 개입니다. 폴더 경로를 지정하세요: ${document.relative}: ${reference}`);
    if (!unique.length || !unique[0].published) return { type: 'text', value: label };
    const targetDocument = unique[0];
    const fragment = anchor ? `#${anchor.startsWith('^') ? anchor.slice(1) : headingSlug(anchor)}` : '';
    return { type: 'link', url: `${targetDocument.href}${fragment}`, children: [{ type: 'text', value: label }] };
  }

  async function asset(target) {
    const decoded = decodeReference(target, document.relative).replace(/\\/g, '/');
    const [filePart] = splitTarget(decoded);
    if (/^[a-z][a-z0-9+.-]*:/i.test(filePart) || path.isAbsolute(filePart)) fail(`로컬 첨부 경로가 올바르지 않습니다: ${document.relative}`);
    let candidate;
    if (filePart.startsWith('blog/assets/')) candidate = path.resolve(sourceDir, filePart.slice(5));
    else if (filePart.startsWith('assets/')) candidate = path.resolve(sourceDir, filePart);
    else candidate = path.resolve(path.dirname(document.file), filePart);
    const real = await fs.realpath(candidate).catch(() => fail(`첨부 파일을 찾을 수 없습니다: ${document.relative}: ${filePart}`));
    if (!inside(assetSource, real) || real === assetSource) fail(`첨부 파일은 blog/assets 안에 있어야 합니다: ${document.relative}`);
    const stat = await fs.stat(real);
    if (!stat.isFile()) fail(`첨부 경로가 파일이 아닙니다: ${document.relative}`);
    const bytes = await fs.readFile(real);
    const sha256 = hash(bytes);
    const extension = path.extname(real).toLowerCase();
    if (!/^\.[a-z0-9]{1,12}$/i.test(extension)) fail(`첨부 파일 확장자가 올바르지 않습니다: ${document.relative}`);
    const file = `${sha256}${extension}`;
    if (!assets.has(file)) {
      await fs.writeFile(path.join(stageAssets, file), bytes);
      assets.set(file, { file, sha256, size: bytes.length });
    }
    return `/blog-assets/${file}`;
  }

  function dimensions(value) {
    const match = /^(\d+)(?:x(\d+))?$/.exec(value);
    if (!match || match.slice(1).filter(Boolean).some((size) => +size < 1 || +size > 10000)) return null;
    return match[2] ? `${+match[1]}x${+match[2]}` : String(+match[1]);
  }

  async function wikiNode(token) {
    const [target, ...aliases] = token.value.split('|');
    const alias = aliases.join('|');
    if (!token.embed) return documentLink(target, alias || path.basename(splitTarget(target)[0]) || document.meta.title);
    const size = alias ? dimensions(alias) : null;
    if (alias && /^\d/.test(alias) && !size) fail(`이미지 크기는 1~10000의 너비 또는 너비x높이로 입력하세요: ${document.relative}`);
    const url = await asset(target);
    const extension = path.extname(splitTarget(target)[0]).toLowerCase();
    const alt = alias && !size ? alias : path.basename(splitTarget(target)[0], extension);
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp'].includes(extension)) {
      return { type: 'link', url, children: [{ type: 'text', value: alt || '첨부파일' }] };
    }
    return { type: 'image', url, alt, ...(size ? { title: `obsidian-size=${size}` } : {}) };
  }

  async function processNode(node, parent) {
    if (node.type === 'code' || node.type === 'inlineCode') return node;
    if (node.type === 'text' && node.value.includes('OBSIDIANEXPORTTOKEN')) {
      const pieces = []; let offset = 0;
      for (const match of node.value.matchAll(/OBSIDIANEXPORTTOKEN\d+ENDTOKEN/g)) {
        if (match.index > offset) pieces.push({ type: 'text', value: node.value.slice(offset, match.index) });
        const token = tokens.get(match[0]);
        if (!token) fail('잘못된 위키링크 변환 토큰입니다.');
        const resolved = await wikiNode(token);
        pieces.push(parent?.type === 'link' && resolved.type === 'link' ? { type: 'text', value: toString(resolved) } : resolved);
        offset = match.index + match[0].length;
      }
      if (offset < node.value.length) pieces.push({ type: 'text', value: node.value.slice(offset) });
      return pieces;
    }
    if (node.type === 'image' || node.type === 'imageReference') {
      let image = node;
      if (node.type === 'imageReference') {
        const definition = tree.children.find((child) => child.type === 'definition' && child.identifier === node.identifier);
        if (!definition) fail(`이미지 참조 정의가 없습니다: ${document.relative}`);
        image = { type: 'image', url: definition.url, title: definition.title, alt: node.alt };
      }
      if (/^https?:\/\//i.test(image.url)) return image;
      image.url = await asset(image.url);
      const suffix = /\|(\d+(?:x\d+)?)$/.exec(image.alt || '');
      if (suffix) {
        const size = dimensions(suffix[1]);
        if (!size) fail(`이미지 크기가 올바르지 않습니다: ${document.relative}`);
        image.alt = image.alt.slice(0, suffix.index);
        image.title = `obsidian-size=${size}`;
      }
      return image;
    }
    if (node.type === 'link' || node.type === 'linkReference') {
      let link = node;
      if (node.type === 'linkReference') {
        const definition = tree.children.find((child) => child.type === 'definition' && child.identifier === node.identifier);
        if (!definition) return node;
        link = { type: 'link', url: definition.url, title: definition.title, children: node.children };
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(link.url) || link.url.startsWith('//')) {
        if (!/^(?:https?:|mailto:|tel:)/i.test(link.url) && !link.url.startsWith('//')) fail(`허용하지 않는 링크 프로토콜입니다: ${document.relative}`);
        return link;
      }
      const bare = splitTarget(link.url)[0];
      const routeMatch = /^\/(posts|notes)\/([^/]+)\/?$/.exec(bare);
      if (routeMatch) {
        const target = documentsForRoute(context, routeMatch[1], decodeReference(routeMatch[2], document.relative));
        return target?.published ? { ...link, url: target.href + (link.url.includes('#') ? '#' + link.url.split('#')[1] : '') } : link.children;
      }
      if (bare.startsWith('/')) return link;
      if (!bare || bare.endsWith('.md') || !path.extname(bare)) {
        const resolved = documentLink(link.url, toString(link));
        return resolved.type === 'link' ? { ...link, url: resolved.url } : link.children;
      }
      link.url = await asset(link.url);
      return link;
    }
    // Definitions are expanded at use sites, preventing private destinations leaking as unused Markdown.
    if (node.type === 'definition') return null;
    if (node.children) {
      const children = [];
      for (const child of node.children) {
        const result = await processNode(child, node);
        if (result) children.push(...(Array.isArray(result) ? result : [result]));
      }
      node.children = children;
    }
    return node;
  }
  await processNode(tree, null);
  const output = writer.stringify(tree);
  if (output.includes('OBSIDIANEXPORTTOKEN')) fail(`변환되지 않은 위키링크가 있습니다: ${document.relative}`);
  return output;
}

function documentsForRoute(context, kind, slug) {
  return context.documents.find((document) => document.kind === kind && (document.meta?.slug || document.data.slug) === slug);
}

async function validateOutputPaths(sourceDir, contentDir, assetsDir) {
  for (const output of [contentDir, assetsDir]) {
    if (inside(sourceDir, output) || inside(output, sourceDir)) fail('출력 경로는 Obsidian 원본과 겹칠 수 없습니다.');
    const existing = await fs.lstat(output).catch(() => null);
    if (existing?.isSymbolicLink()) fail('출력 경로에 symlink를 사용할 수 없습니다.');
  }
  if (inside(contentDir, assetsDir) || inside(assetsDir, contentDir)) fail('콘텐츠와 첨부 출력 경로가 겹칩니다.');
}

async function canonicalOutput(output) {
  output = path.resolve(output);
  if ((await fs.lstat(output).catch(() => null))?.isSymbolicLink()) fail('출력 경로에 symlink를 사용할 수 없습니다.');
  const missing = [];
  let existing = output;
  while (!existsSync(existing)) {
    missing.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    if (parent === existing) fail('출력 경로를 해석할 수 없습니다.');
    existing = parent;
  }
  return path.join(await fs.realpath(existing), ...missing);
}

async function replaceOutputs(pairs) {
  const records = [];
  try {
    for (const [stage, output] of pairs) {
      const backup = `${output}.obsidian-backup-${randomUUID()}`;
      const hadOutput = existsSync(output);
      if (hadOutput) await fs.rename(output, backup);
      const record = { output, backup, hadOutput, installed: false };
      records.push(record);
      await fs.rename(stage, output);
      record.installed = true;
    }
  } catch (error) {
    const recoveryErrors = [];
    for (const record of records.reverse()) {
      try {
        if (record.installed) await fs.rm(record.output, { recursive: true, force: true });
        if (record.hadOutput) await fs.rename(record.backup, record.output);
      } catch { recoveryErrors.push(record.backup); }
    }
    if (recoveryErrors.length) throw new Error(`내보내기 복원 실패. 백업 경로: ${recoveryErrors.join(', ')}`, { cause: error });
    throw error;
  }
  for (const record of records) if (record.hadOutput) await fs.rm(record.backup, { recursive: true, force: true });
}

/** Read the vault without modifying it; replace only the dedicated public snapshot outputs. */
export async function syncContent({ sourceDir, contentDir, assetsDir }) {
  if (!sourceDir) fail('OBSIDIAN_BLOG_DIR 또는 --source로 Obsidian blog 폴더를 지정하세요.');
  sourceDir = await fs.realpath(path.resolve(sourceDir)).catch(() => fail('Obsidian blog 폴더를 찾을 수 없습니다. OBSIDIAN_BLOG_DIR를 확인하세요.'));
  contentDir = await canonicalOutput(contentDir);
  assetsDir = await canonicalOutput(assetsDir);
  await validateOutputPaths(sourceDir, contentDir, assetsDir);
  const documents = await readDocuments(sourceDir);
  const published = documents.filter((document) => document.published);
  const routes = new Set();
  for (const document of published) {
    document.meta = metadata(document);
    document.href = `/${document.kind}/${encodeURIComponent(document.meta.slug)}/`;
    const collision = `${document.kind}/${document.meta.slug.toLocaleLowerCase('en-US')}`;
    if (routes.has(collision)) fail(`공개 문서 slug가 중복됩니다: ${document.kind}/${document.meta.slug}`);
    routes.add(collision);
  }
  const assetsRoot = path.join(sourceDir, 'assets');
  const assetSource = await fs.realpath(assetsRoot).catch(() => path.resolve(assetsRoot));
  // A symlinked assets directory could otherwise grant the entire external target.
  if ((await fs.lstat(assetsRoot).catch(() => null))?.isSymbolicLink()) fail('assets 폴더 자체에 symlink를 사용할 수 없습니다.');
  await fs.mkdir(path.dirname(contentDir), { recursive: true });
  await fs.mkdir(path.dirname(assetsDir), { recursive: true });
  const tempContent = await fs.mkdtemp(path.join(path.dirname(contentDir), '.obsidian-content-'));
  const tempAssets = await fs.mkdtemp(path.join(path.dirname(assetsDir), '.obsidian-assets-'));
  try {
    for (const kind of kinds) await fs.mkdir(path.join(tempContent, kind));
    const assets = new Map();
    const entries = [];
    const context = { sourceDir, assetSource, stageAssets: tempAssets, assets, documents, index: referenceIndex(documents) };
    for (const document of published) {
      const body = await transformBody(document, context);
      if (!document.data.summary?.trim()) document.meta.summary = plainSummary(body);
      const output = `---\n${stringifyYaml(document.meta, { lineWidth: 0 })}---\n\n${body}`;
      const file = `${document.kind}/${document.meta.slug}.md`;
      await fs.writeFile(path.join(tempContent, file), output);
      entries.push({ kind: document.kind, slug: document.meta.slug, href: document.href, file, sha256: hash(output), ...document.meta });
    }
    entries.sort((a, b) => b.date.localeCompare(a.date) || a.href.localeCompare(b.href));
    const manifest = { version: 1, entries, assets: [...assets.values()].sort((a, b) => a.file.localeCompare(b.file)) };
    await fs.writeFile(path.join(tempContent, 'export-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await verifySnapshot({ contentDir: tempContent, assetsDir: tempAssets });
    await replaceOutputs([[tempContent, contentDir], [tempAssets, assetsDir]]);
    return manifest;
  } finally {
    await fs.rm(tempContent, { recursive: true, force: true });
    await fs.rm(tempAssets, { recursive: true, force: true });
  }
}

async function fileSet(directory) {
  const results = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) fail(`snapshot에 symlink가 있습니다: ${entry.name}`);
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile()) results.push(path.relative(directory, filename).split(path.sep).join('/'));
      else fail('snapshot에 일반 파일이 아닌 항목이 있습니다.');
    }
  }
  await walk(directory);
  return results.sort();
}

/** Verify the complete self-contained snapshot before a source-free CI/deployment build. */
export async function verifySnapshot({ contentDir, assetsDir }) {
  contentDir = path.resolve(contentDir); assetsDir = path.resolve(assetsDir);
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(contentDir, 'export-manifest.json'), 'utf8')); }
  catch { fail('공개 콘텐츠 snapshot이 없습니다. 로컬에서 pnpm sync:content를 먼저 실행하세요.'); }
  if (manifest.version !== 1 || !Array.isArray(manifest.entries) || !Array.isArray(manifest.assets)) fail('지원하지 않는 공개 snapshot 형식입니다.');
  const expectedFiles = ['export-manifest.json']; const expectedAssets = []; const routes = new Set();
  for (const entry of manifest.entries) {
    if (!kinds.includes(entry.kind)) fail('snapshot 문서 종류가 올바르지 않습니다.');
    const slug = validSlug(entry.slug, 'snapshot');
    const file = `${entry.kind}/${slug}.md`;
    const href = `/${entry.kind}/${encodeURIComponent(slug)}/`;
    if (entry.file !== file || entry.href !== href || routes.has(href.toLocaleLowerCase('en-US'))) fail('snapshot 문서 경로나 slug가 올바르지 않습니다.');
    routes.add(href.toLocaleLowerCase('en-US'));
    const bytes = await fs.readFile(path.join(contentDir, file)).catch(() => fail(`snapshot 문서가 없습니다: ${file}`));
    if (hash(bytes) !== entry.sha256) fail(`snapshot 문서 해시가 다릅니다: ${file}`);
    const parsed = parseFrontmatter(bytes.toString(), file);
    if (parsed.data.publish !== true || entry.publish !== true) fail('비공개 문서가 snapshot에 포함되었습니다.');
    const normalizedMeta = metadata({ ...parsed, file, relative: file, kind: entry.kind });
    for (const key of Object.keys(normalizedMeta)) {
      if (JSON.stringify(normalizedMeta[key]) !== JSON.stringify(entry[key])) fail(`snapshot 메타데이터가 다릅니다: ${file}: ${key}`);
    }
    expectedFiles.push(file);
  }
  for (const asset of manifest.assets) {
    if (typeof asset.file !== 'string' || !/^[a-f0-9]{64}\.[a-z0-9]{1,12}$/.test(asset.file) || expectedAssets.includes(asset.file)) fail('snapshot 첨부 경로가 올바르지 않습니다.');
    const bytes = await fs.readFile(path.join(assetsDir, asset.file)).catch(() => fail('snapshot 첨부 파일이 없습니다.'));
    if (hash(bytes) !== asset.sha256 || bytes.length !== asset.size || !asset.file.startsWith(asset.sha256 + '.')) fail('snapshot 첨부 파일 해시가 다릅니다.');
    expectedAssets.push(asset.file);
  }
  const actualFiles = await fileSet(contentDir);
  const actualAssets = await fileSet(assetsDir);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles.sort()) || JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets.sort())) {
    fail('snapshot에 누락되거나 목록에 없는 파일이 있습니다. sync:content를 다시 실행하세요.');
  }
  return manifest;
}
