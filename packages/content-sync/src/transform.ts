import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rewriteAssets } from "./assets.js";
import { parseNote, stringifyFrontmatter } from "./frontmatter.js";
import { createNoteIndex, rewriteWikilinks, type NoteIndexEntry } from "./obsidian-links.js";
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
  type PublicLinkIndex,
  type PublishManifest,
  type ResolvedAsset,
  type TransformOptions,
} from "./schema.js";
import { checksum, isWithin, slugify, walkFiles } from "./utils.js";

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
    const title = asString(note.frontmatter.title) ?? path.basename(note.sourcePath, path.extname(note.sourcePath));
    const description = asString(note.frontmatter.description) ?? "";
    const slug = asString(note.frontmatter.slug) ?? slugify(title);
    const published = asBoolean(note.frontmatter.published) === true;
    const tags = asStringArray(note.frontmatter.tags) ?? [];
    const isInPublishedRoot = isWithin(sourceDir, note.sourcePath);
    return {
      note,
      slug,
      title,
      description,
      excerpt: extractExcerpt(note.body),
      tags,
      headings: extractHeadings(note.body),
      blockAnchors: extractBlockAnchors(note.body),
      duplicateBlockIds: extractDuplicateBlockIds(note.body),
      isPublic: published && isInPublishedRoot,
    };
  });
  const noteIndex = createNoteIndex(
    prevalidated.map<NoteIndexEntry>(({ note, slug, title, description, headings, blockAnchors, isPublic }) => ({
      sourcePath: note.sourcePath,
      slug,
      title,
      description,
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
      slug: item.slug,
      title: item.title,
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
    cleanupGeneratedOutputs(outputDir, assetOutputDir, options.publicLinkIndexPath);
    writeManifest(manifest, options.manifestPath);
    throw new Error(`Content sync failed with ${errors.length} blocking error(s).`);
  }

  try {
    commitGeneratedOutputs(pendingWrites, outputDir, assetOutputDir);
    writeManifest(manifest, options.manifestPath);
    if (options.publicLinkIndexPath && errors.length === 0) {
      writePublicLinkIndex(buildPublicLinkIndex(exportedPosts, prevalidated), options.publicLinkIndexPath);
    }
  } catch (error) {
    cleanupGeneratedOutputs(outputDir, assetOutputDir, options.publicLinkIndexPath);
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

function cleanupGeneratedOutputs(outputDir: string, assetOutputDir: string, publicLinkIndexPath?: string): void {
  rmSync(outputDir, { recursive: true, force: true });
  rmSync(assetOutputDir, { recursive: true, force: true });
  removeFile(publicLinkIndexPath);
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
  slug: string;
  title: string;
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

  const modelResult = createContentModel(note, slug, state, input.hasDuplicateSlug);
  warnings.push(...modelResult.warnings);
  errors.push(...modelResult.errors);
  for (const id of input.duplicateBlockIds) {
    errors.push(`Duplicate block id: ${id}`);
  }

  const linkResult = rewriteWikilinks(modelResult.value?.body ?? note.body, input.noteIndex, {
    sourceSlug: slug,
    sourceTitle: input.title,
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
  const outputText = `${frontmatter}${normalizeCallouts(normalizeBlockAnchors(assetResult.body)).trimEnd()}\n`;
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

function createContentModel(
  note: ParsedNote,
  slug: string,
  state: ContentModel["state"],
  hasDuplicateSlug: boolean,
): {
  value?: ContentModel;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const title = asString(note.frontmatter.title);
  const description = asString(note.frontmatter.description);
  const date = asString(note.frontmatter.date);
  const updated = asString(note.frontmatter.updated);
  const tags = asStringArray(note.frontmatter.tags);
  const series = asString(note.frontmatter.series);
  const seriesOrder = asNumber(note.frontmatter.seriesOrder);

  if (!title) errors.push("Missing required frontmatter: title");
  if (!description) errors.push("Missing required frontmatter: description");
  if (!date || Number.isNaN(Date.parse(date))) errors.push("Missing or invalid required frontmatter: date");
  if (!tags || tags.length === 0) errors.push("Missing or invalid required frontmatter: tags");
  if (!series) errors.push("Missing required frontmatter: series");
  if (hasDuplicateSlug) errors.push(`Duplicate slug: ${slug}`);
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
      tags: tags!,
      series: series!,
      seriesOrder,
      headings: extractHeadings(note.body),
      outboundLinks: [],
      assets: [],
      body: note.body,
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

function buildPublicLinkIndex(
  exportedPosts: ManifestEntry[],
  notes: Array<{
    slug: string;
    title: string;
    description: string;
    excerpt: string;
    tags: string[];
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
      href: `/posts/${note.slug}/`,
      headings: note.headings,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const edges = exportedPosts
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

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
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

function normalizeCallouts(body: string): string {
  return body.replace(/^>\s*\[!(\w+)\]\s*(.*)$/gm, (_, type, title) => {
    const label = String(type).replace(/^\w/, (char) => char.toUpperCase());
    const suffix = title ? ` ${title}` : "";
    return `> **${label}:**${suffix}`;
  });
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
