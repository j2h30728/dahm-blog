import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rewriteAssets } from "./assets.js";
import { parseNote, stringifyFrontmatter } from "./frontmatter.js";
import { createNoteIndex, rewriteWikilinks, type NoteIndexEntry } from "./obsidian-links.js";
import { normalizeObsidianSyntax, type ObsidianSyntaxResult } from "./obsidian-syntax.js";
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  type BlockAnchor,
  type ContentModel,
  type HeadingNode,
  type ManifestEntry,
  type ParsedNote,
  type PublicGraphIndex,
  type PublicLinkIndex,
  type PublicProperty,
  type PublicTagIndex,
  type PublishManifest,
  type ResolvedAsset,
  type TransformOptions,
} from "./schema.js";
import { checksum, isWithin, slugify, walkFiles } from "./utils.js";

const RESERVED_PROPERTY_NAMES = new Set([
  "title",
  "slug",
  "description",
  "date",
  "updated",
  "tags",
  "series",
  "seriesOrder",
  "published",
  "archived",
  "state",
  "aliases",
  "alias",
  "cssclasses",
  "cssclass",
]);

interface TransformNoteResult {
  entry: ManifestEntry;
  outputText?: string;
}

interface PendingPostWrite {
  outputPath: string;
  outputText: string;
  copiedAssets: ResolvedAsset[];
}

export function transformVault(options: TransformOptions): PublishManifest {
  const vaultRoot = path.resolve(options.vaultRoot);
  const sourceDir = path.resolve(options.sourceDir ?? path.join(vaultRoot, "published"));
  const outputDir = path.resolve(options.outputDir);
  const assetOutputDir = path.resolve(options.assetOutputDir);
  const privateRoot = path.join(vaultRoot, "private");

  if (!existsSync(vaultRoot)) {
    throw new Error(`Vault root does not exist: ${vaultRoot}`);
  }
  if (!existsSync(sourceDir)) {
    throw new Error(`Published source directory does not exist: ${sourceDir}`);
  }
  if (!isWithin(vaultRoot, sourceDir)) {
    throw new Error(`Published source directory must be inside the vault root: ${sourceDir}`);
  }
  if (isWithin(privateRoot, sourceDir)) {
    throw new Error(`Published source directory cannot be inside private content: ${sourceDir}`);
  }
  if (walkFiles(sourceDir).length === 0) {
    throw new Error(`No published Markdown files found in source directory: ${sourceDir}`);
  }

  rmSync(outputDir, { recursive: true, force: true });

  const sourceFiles = walkFiles(vaultRoot);
  const parsedNotes = sourceFiles.map((file) => parseNote(file, readFileSync(file, "utf8")));
  const prevalidated = parsedNotes.map((note) => {
    const syntax = normalizeObsidianSyntax(note.body);
    const title = asString(note.frontmatter.title) ?? path.basename(note.sourcePath, path.extname(note.sourcePath));
    const description = asString(note.frontmatter.description) ?? "";
    const slug = asString(note.frontmatter.slug) ?? slugify(title);
    const published = asBoolean(note.frontmatter.published) === true;
    const tags = mergeTags(asStringArray(note.frontmatter.tags) ?? [], syntax.tags);
    const aliases = collectAliases(note.frontmatter);
    const cssclasses = collectCssClasses(note.frontmatter);
    const properties = collectPublicProperties(note.frontmatter);
    const isInPublishedRoot = isWithin(sourceDir, note.sourcePath);
    return {
      note,
      syntax,
      slug,
      title,
      description,
      excerpt: extractExcerpt(syntax.body),
      tags,
      aliases,
      cssclasses,
      properties,
      headings: extractHeadings(syntax.body),
      blockAnchors: extractBlockAnchors(syntax.body),
      duplicateBlockIds: extractDuplicateBlockIds(syntax.body),
      isPublic: published && isInPublishedRoot,
    };
  });
  const noteIndex = createNoteIndex(
    prevalidated.map<NoteIndexEntry>(({ note, slug, title, description, aliases, headings, blockAnchors, isPublic }) => ({
      sourcePath: note.sourcePath,
      slug,
      title,
      description,
      aliases,
      headings,
      blockAnchors,
      isPublic,
    })),
  );

  const exportedPosts: ManifestEntry[] = [];
  const skippedPosts: ManifestEntry[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const pendingWrites: PendingPostWrite[] = [];
  const duplicateSlugs = findDuplicateSlugs(prevalidated.map((item) => item.slug));

  for (const item of prevalidated) {
    if (!isWithin(sourceDir, item.note.sourcePath)) {
      continue;
    }

    const result = transformNote({
      note: item.note,
      syntax: item.syntax,
      slug: item.slug,
      title: item.title,
      tags: item.tags,
      aliases: item.aliases,
      cssclasses: item.cssclasses,
      properties: item.properties,
      duplicateBlockIds: item.duplicateBlockIds,
      noteIndex,
      options: {
        vaultRoot,
        outputDir,
        assetOutputDir,
        privateRoot,
      },
      hasDuplicateSlug: duplicateSlugs.has(item.slug),
      preview: options.preview === true,
    });
    const { entry } = result;

    if (entry.outputPath) {
      exportedPosts.push(entry);
      if (result.outputText) {
        pendingWrites.push({
          outputPath: entry.outputPath,
          outputText: result.outputText,
          copiedAssets: entry.copiedAssets,
        });
      }
    } else {
      skippedPosts.push(entry);
    }
    warnings.push(...entry.warnings);
    errors.push(...entry.errors);
  }

  const manifest: PublishManifest = {
    generatedAt: new Date().toISOString(),
    exportedPosts,
    skippedPosts,
    warnings,
    errors,
  };

  if (errors.length > 0 && !options.preview) {
    cleanupGeneratedOutputs(outputDir, assetOutputDir, [
      options.publicLinkIndexPath,
      options.publicGraphIndexPath,
      options.publicTagIndexPath,
    ]);
    writeManifest(manifest, options.manifestPath);
    throw new Error(`Content sync failed with ${errors.length} blocking error(s).`);
  }

  try {
    commitGeneratedOutputs(pendingWrites, outputDir, assetOutputDir);
    writeManifest(manifest, options.manifestPath);
    if (options.publicLinkIndexPath && errors.length === 0) {
      writePublicLinkIndex(buildPublicLinkIndex(exportedPosts, prevalidated), options.publicLinkIndexPath);
    }
    if (options.publicGraphIndexPath && errors.length === 0) {
      writePublicGraphIndex(buildPublicGraphIndex(exportedPosts, prevalidated), options.publicGraphIndexPath);
    }
    if (options.publicTagIndexPath && errors.length === 0) {
      writePublicTagIndex(buildPublicTagIndex(exportedPosts, prevalidated), options.publicTagIndexPath);
    }
  } catch (error) {
    cleanupGeneratedOutputs(outputDir, assetOutputDir, [
      options.publicLinkIndexPath,
      options.publicGraphIndexPath,
      options.publicTagIndexPath,
    ]);
    removeFile(options.manifestPath);
    throw error;
  }

  return manifest;
}

function writeManifest(manifest: PublishManifest, manifestPath?: string): void {
  if (!manifestPath) return;
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writePublicLinkIndex(publicLinkIndex: PublicLinkIndex, publicLinkIndexPath: string): void {
  mkdirSync(path.dirname(publicLinkIndexPath), { recursive: true });
  writeFileSync(publicLinkIndexPath, `${JSON.stringify(publicLinkIndex, null, 2)}\n`);
}

function writePublicGraphIndex(publicGraphIndex: PublicGraphIndex, publicGraphIndexPath: string): void {
  mkdirSync(path.dirname(publicGraphIndexPath), { recursive: true });
  writeFileSync(publicGraphIndexPath, `${JSON.stringify(publicGraphIndex, null, 2)}\n`);
}

function writePublicTagIndex(publicTagIndex: PublicTagIndex, publicTagIndexPath: string): void {
  mkdirSync(path.dirname(publicTagIndexPath), { recursive: true });
  writeFileSync(publicTagIndexPath, `${JSON.stringify(publicTagIndex, null, 2)}\n`);
}

function cleanupGeneratedOutputs(outputDir: string, assetOutputDir: string, publicArtifactPaths: Array<string | undefined> = []): void {
  rmSync(outputDir, { recursive: true, force: true });
  rmSync(assetOutputDir, { recursive: true, force: true });
  for (const artifactPath of publicArtifactPaths) {
    removeFile(artifactPath);
  }
}

function removeFile(filePath?: string): void {
  if (!filePath) return;
  rmSync(filePath, { force: true });
}

function commitGeneratedOutputs(pendingWrites: PendingPostWrite[], outputDir: string, assetOutputDir: string): void {
  const nonce = `${process.pid}-${Date.now()}`;
  const outputStageDir = path.join(path.dirname(outputDir), `.${path.basename(outputDir)}.tmp-${nonce}`);
  const assetStageDir = path.join(path.dirname(assetOutputDir), `.${path.basename(assetOutputDir)}.tmp-${nonce}`);

  try {
    rmSync(outputStageDir, { recursive: true, force: true });
    rmSync(assetStageDir, { recursive: true, force: true });
    mkdirSync(outputStageDir, { recursive: true });
    mkdirSync(assetStageDir, { recursive: true });

    for (const pending of pendingWrites) {
      if (!isWithin(outputDir, pending.outputPath)) {
        throw new Error(`Generated post output escapes output directory: ${pending.outputPath}`);
      }
      const stagedOutputPath = path.join(outputStageDir, path.relative(outputDir, pending.outputPath));
      mkdirSync(path.dirname(stagedOutputPath), { recursive: true });
      writeFileSync(stagedOutputPath, pending.outputText);

      for (const asset of pending.copiedAssets) {
        if (asset.status !== "public" || !asset.outputPath) continue;
        if (!isWithin(assetOutputDir, asset.outputPath)) {
          throw new Error(`Generated asset output escapes asset directory: ${asset.outputPath}`);
        }
        const stagedAssetPath = path.join(assetStageDir, path.relative(assetOutputDir, asset.outputPath));
        mkdirSync(path.dirname(stagedAssetPath), { recursive: true });
        copyFileSync(asset.sourcePath, stagedAssetPath);
      }
    }

    rmSync(outputDir, { recursive: true, force: true });
    rmSync(assetOutputDir, { recursive: true, force: true });
    mkdirSync(path.dirname(outputDir), { recursive: true });
    mkdirSync(path.dirname(assetOutputDir), { recursive: true });
    renameSync(outputStageDir, outputDir);
    renameSync(assetStageDir, assetOutputDir);
  } catch (error) {
    cleanupGeneratedOutputs(outputDir, assetOutputDir);
    rmSync(outputStageDir, { recursive: true, force: true });
    rmSync(assetStageDir, { recursive: true, force: true });
    throw error;
  }
}

function transformNote(input: {
  note: ParsedNote;
  syntax: ObsidianSyntaxResult;
  slug: string;
  title: string;
  tags: string[];
  aliases: string[];
  cssclasses: string[];
  properties: PublicProperty[];
  duplicateBlockIds: string[];
  noteIndex: ReturnType<typeof createNoteIndex>;
  options: {
    vaultRoot: string;
    outputDir: string;
    assetOutputDir: string;
    privateRoot: string;
  };
  hasDuplicateSlug: boolean;
  preview: boolean;
}): TransformNoteResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { note, slug } = input;
  const sourceText = readFileSync(note.sourcePath, "utf8");
  const state = getState(note);
  const sourceChecksum = checksum(sourceText);
  const published = asBoolean(note.frontmatter.published) === true;

  if (!published && !input.preview) {
    return {
      entry: {
        sourcePath: note.sourcePath,
        slug,
        state,
        sourceChecksum,
        copiedAssets: [],
        rewrittenLinks: [],
        warnings,
        errors: ["Note is inside published/ but missing published: true"],
      },
    };
  }

  const modelResult = createContentModel({
    note,
    syntax: input.syntax,
    slug,
    state,
    tags: input.tags,
    aliases: input.aliases,
    cssclasses: input.cssclasses,
    properties: input.properties,
    hasDuplicateSlug: input.hasDuplicateSlug,
  });
  warnings.push(...modelResult.warnings);
  errors.push(...modelResult.errors);
  for (const id of input.duplicateBlockIds) {
    errors.push(`Duplicate block id: ${id}`);
  }

  const linkResult = rewriteWikilinks(modelResult.value?.body ?? note.body, input.noteIndex, {
    sourceSlug: slug,
    sourceTitle: input.title,
    sourcePath: note.sourcePath,
  });
  if (modelResult.value) {
    modelResult.value.outboundLinks = linkResult.references;
  }
  errors.push(...linkResult.errors);

  const assetResult = rewriteAssets(linkResult.body, {
    sourcePath: note.sourcePath,
    vaultRoot: input.options.vaultRoot,
    outputRoot: input.options.assetOutputDir,
    markdownOutputPath: path.join(input.options.outputDir, `${slug}.mdx`),
    slug,
    privateRoot: input.options.privateRoot,
  });
  errors.push(...assetResult.errors);

  if (errors.length > 0 && !input.preview) {
    return {
      entry: {
        sourcePath: note.sourcePath,
        slug,
        state,
        sourceChecksum,
        copiedAssets: assetResult.assets,
        rewrittenLinks: linkResult.references,
        warnings,
        errors,
      },
    };
  }

  const frontmatter = stringifyFrontmatter({
    title: modelResult.value?.title,
    slug,
    description: modelResult.value?.description,
    date: modelResult.value?.date,
    updated: modelResult.value?.updated,
    tags: modelResult.value?.tags ?? [],
    series: modelResult.value?.series,
    seriesOrder: modelResult.value?.seriesOrder,
    published: state === "published",
  });
  const outputText = `${frontmatter}${normalizeBlockAnchors(assetResult.body).trimEnd()}\n`;
  const outputPath = path.join(input.options.outputDir, `${slug}.mdx`);

  return {
    entry: {
      sourcePath: note.sourcePath,
      outputPath,
      slug,
      state,
      sourceChecksum,
      outputChecksum: checksum(outputText),
      copiedAssets: assetResult.assets,
      rewrittenLinks: linkResult.references,
      warnings,
      errors,
    },
    outputText,
  };
}

function createContentModel(input: {
  note: ParsedNote;
  syntax: ObsidianSyntaxResult;
  slug: string;
  state: ContentModel["state"];
  tags: string[];
  aliases: string[];
  cssclasses: string[];
  properties: PublicProperty[];
  hasDuplicateSlug: boolean;
}): {
  value?: ContentModel;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { note, syntax, slug, state } = input;
  const title = asString(note.frontmatter.title);
  const description = asString(note.frontmatter.description);
  const date = asString(note.frontmatter.date);
  const updated = asString(note.frontmatter.updated);
  const series = asString(note.frontmatter.series);
  const seriesOrder = asNumber(note.frontmatter.seriesOrder);

  if (!title) errors.push("Missing required frontmatter: title");
  if (!description) errors.push("Missing required frontmatter: description");
  if (!date || Number.isNaN(Date.parse(date))) errors.push("Missing or invalid required frontmatter: date");
  if (input.tags.length === 0) errors.push("Missing or invalid required frontmatter: tags");
  if (!series) errors.push("Missing required frontmatter: series");
  if (input.hasDuplicateSlug) errors.push(`Duplicate slug: ${slug}`);
  if (!updated) warnings.push("Missing optional frontmatter: updated");

  if (errors.length > 0) {
    return { warnings, errors };
  }

  return {
    value: {
      sourcePath: note.sourcePath,
      slug,
      title: title!,
      description: description!,
      date: date!,
      updated,
      tags: input.tags,
      aliases: input.aliases,
      cssclasses: input.cssclasses,
      properties: input.properties,
      series: series!,
      seriesOrder,
      headings: extractHeadings(syntax.body),
      outboundLinks: [],
      assets: [],
      embeds: [],
      tasks: syntax.tasks,
      callouts: syntax.callouts,
      body: syntax.body,
      state,
    },
    warnings,
    errors,
  };
}

function getState(note: ParsedNote): ContentModel["state"] {
  if (asBoolean(note.frontmatter.archived) === true || note.frontmatter.state === "archived") {
    return "archived";
  }
  if (asBoolean(note.frontmatter.published) === true) {
    return "published";
  }
  return "draft";
}

export function extractHeadings(body: string): HeadingNode[] {
  const seen = new Map<string, number>();
  const headings: HeadingNode[] = [];

  for (const line of body.split(/\r?\n/)) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;

    const depth = match[1].length as 2 | 3;
    const text = match[2].replace(/#+$/, "").trim();
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({
      depth,
      text,
      id: count === 0 ? base : `${base}-${count + 1}`,
    });
  }

  return headings;
}

export function extractBlockAnchors(body: string): BlockAnchor[] {
  return collectBlockAnchors(body).anchors;
}

export function extractDuplicateBlockIds(body: string): string[] {
  return Array.from(collectBlockAnchors(body).duplicates).sort();
}

function normalizeBlockAnchors(body: string): string {
  const lines = body.split(/\r?\n/);
  let inFence = false;

  const rewritten = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    const standalone = /^\s*\^([A-Za-z0-9_-]+)\s*$/.exec(line);
    if (standalone) {
      return `<span id="block-${standalone[1]}"></span>`;
    }

    const inline = /^(.*?)(?:\s+)\^([A-Za-z0-9_-]+)\s*$/.exec(line);
    if (inline) {
      return `${inline[1]} <span id="block-${inline[2]}"></span>`;
    }

    return line;
  });

  return rewritten.join("\n");
}

function collectBlockAnchors(body: string): { anchors: BlockAnchor[]; duplicates: Set<string> } {
  const anchors: BlockAnchor[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let inFence = false;

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const standalone = /^\s*\^([A-Za-z0-9_-]+)\s*$/.exec(line);
    const inline = /(?:^|\s)\^([A-Za-z0-9_-]+)\s*$/.exec(line);
    const id = standalone?.[1] ?? inline?.[1];
    if (!id) continue;

    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
    anchors.push({ id, anchor: `block-${id}` });
  }

  return { anchors, duplicates };
}

function mergeTags(...tagGroups: string[][]): string[] {
  const tags = new Set<string>();
  for (const group of tagGroups) {
    for (const tag of group) {
      const normalized = normalizeTag(tag);
      if (normalized) tags.add(normalized);
    }
  }
  return Array.from(tags);
}

function normalizeTag(tag: string): string {
  return tag.replace(/^#+/, "").trim();
}

function collectAliases(frontmatter: Record<string, unknown>): string[] {
  return normalizeStringList(frontmatter.aliases ?? frontmatter.alias);
}

function collectCssClasses(frontmatter: Record<string, unknown>): string[] {
  return normalizeStringList(frontmatter.cssclasses ?? frontmatter.cssclass);
}

function normalizeStringList(value: unknown): string[] {
  return Array.from(new Set(asStringArray(value) ?? [])).sort((a, b) => a.localeCompare(b));
}

function collectPublicProperties(frontmatter: Record<string, unknown>): PublicProperty[] {
  return Object.entries(frontmatter)
    .filter(([name]) => !isReservedProperty(name) && !isSensitivePropertyName(name))
    .map(([name, value]) => toPublicProperty(name, value))
    .filter((property): property is PublicProperty => property !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toPublicProperty(name: string, value: unknown): PublicProperty | null {
  if (typeof value === "string") {
    if (value.trim().length === 0 || isSensitivePropertyValue(value)) return null;
    return { name, type: inferStringPropertyType(value), value };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { name, type: "number", value };
  }
  if (typeof value === "boolean") {
    return { name, type: "checkbox", value };
  }
  if (value instanceof Date) {
    return { name, type: "datetime", value: value.toISOString() };
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && !isSensitivePropertyValue(item))) {
    return {
      name,
      type: "list",
      value: value.map((item) => item.trim()).filter(Boolean),
    };
  }
  return null;
}

function inferStringPropertyType(value: string): PublicProperty["type"] {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  if (!Number.isNaN(Date.parse(value)) && /[T:]/.test(value)) return "datetime";
  return "text";
}

function isReservedProperty(name: string): boolean {
  return RESERVED_PROPERTY_NAMES.has(name);
}

function isSensitivePropertyName(name: string): boolean {
  return /(private|secret|token|password|source|path|vault|raw|replacement|context)/i.test(name);
}

function isSensitivePropertyValue(value: string): boolean {
  return /(content\/private|\/private\/|file:\/\/|obsidian:\/\/)/i.test(value);
}

function buildPublicLinkIndex(
  exportedPosts: ManifestEntry[],
  notes: Array<{
    slug: string;
    title: string;
    description: string;
    excerpt: string;
    tags: string[];
    aliases: string[];
    properties: PublicProperty[];
    headings: HeadingNode[];
    isPublic: boolean;
  }>,
): PublicLinkIndex {
  const exportedSlugs = new Set(exportedPosts.map((post) => post.slug).filter((slug): slug is string => Boolean(slug)));
  const nodes = notes
    .filter((note) => note.isPublic && exportedSlugs.has(note.slug))
    .map((note) => ({
      slug: note.slug,
      title: note.title,
      description: note.description,
      excerpt: note.excerpt,
      tags: note.tags,
      aliases: note.aliases,
      href: `/posts/${note.slug}/`,
      headings: note.headings,
      properties: note.properties,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges: buildPublicLinkEdges(exportedPosts),
  };
}

function buildPublicGraphIndex(
  exportedPosts: ManifestEntry[],
  notes: Array<{
    slug: string;
    title: string;
    tags: string[];
    isPublic: boolean;
  }>,
): PublicGraphIndex {
  const exportedSlugs = new Set(exportedPosts.map((post) => post.slug).filter((slug): slug is string => Boolean(slug)));
  return {
    generatedAt: new Date().toISOString(),
    nodes: notes
      .filter((note) => note.isPublic && exportedSlugs.has(note.slug))
      .map((note) => ({
        slug: note.slug,
        title: note.title,
        href: `/posts/${note.slug}/`,
        tags: note.tags,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    edges: buildPublicLinkEdges(exportedPosts),
  };
}

function buildPublicLinkEdges(exportedPosts: ManifestEntry[]): PublicLinkIndex["edges"] {
  return exportedPosts
    .flatMap((post) =>
      post.rewrittenLinks
        .filter((reference) => reference.status === "public" && reference.targetSlug && post.slug && reference.role !== "embed")
        .map((reference, order) => ({
          sourceSlug: post.slug!,
          targetSlug: reference.targetSlug!,
          kind: reference.fragmentKind ?? "none",
          targetAnchor: reference.targetAnchor,
          label: reference.label ?? reference.target,
          order,
        })),
    )
    .sort((a, b) => {
      const source = a.sourceSlug.localeCompare(b.sourceSlug);
      if (source !== 0) return source;
      const target = a.targetSlug.localeCompare(b.targetSlug);
      if (target !== 0) return target;
      return a.order - b.order;
    })
    .map(({ order: _order, ...edge }) => edge);
}

function buildPublicTagIndex(
  exportedPosts: ManifestEntry[],
  notes: Array<{
    slug: string;
    tags: string[];
    isPublic: boolean;
  }>,
): PublicTagIndex {
  const exportedSlugs = new Set(exportedPosts.map((post) => post.slug).filter((slug): slug is string => Boolean(slug)));
  const tagMap = new Map<string, Set<string>>();
  for (const note of notes) {
    if (!note.isPublic || !exportedSlugs.has(note.slug)) continue;
    for (const tag of note.tags) {
      const slugs = tagMap.get(tag) ?? new Set<string>();
      slugs.add(note.slug);
      tagMap.set(tag, slugs);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    tags: Array.from(tagMap.entries())
      .map(([tag, slugs]) => ({ tag, slugs: Array.from(slugs).sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}

function extractExcerpt(body: string): string {
  const paragraphs: string[][] = [];
  let current: string[] = [];
  let inFence = false;

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || /^\s*#{1,6}\s+/.test(line)) continue;

    if (line.trim().length === 0) {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
      continue;
    }

    current.push(line.trim());
  }

  if (current.length > 0) {
    paragraphs.push(current);
  }

  const paragraph = paragraphs[0]?.join(" ") ?? "";
  return toPlainPreviewText(paragraph).slice(0, 180).trim();
}

function toPlainPreviewText(value: string): string {
  return value
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|#^]+)(?:[#^][^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias ?? target)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+\^[A-Za-z0-9_-]+\b/g, "")
    .replace(/[`*_~>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findDuplicateSlugs(slugs: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  return duplicates;
}
