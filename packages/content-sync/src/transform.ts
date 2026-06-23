import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rewriteAssets } from "./assets.js";
import { parseNote, stringifyFrontmatter } from "./frontmatter.js";
import { createNoteIndex, rewriteWikilinks, type NoteIndexEntry } from "./obsidian-links.js";
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  type ContentModel,
  type HeadingNode,
  type ManifestEntry,
  type ParsedNote,
  type PublishManifest,
  type TransformOptions,
} from "./schema.js";
import { checksum, isWithin, slugify, walkFiles } from "./utils.js";

export function transformVault(options: TransformOptions): PublishManifest {
  const vaultRoot = path.resolve(options.vaultRoot);
  const sourceDir = path.resolve(options.sourceDir ?? path.join(vaultRoot, "published"));
  const outputDir = path.resolve(options.outputDir);
  const assetOutputDir = path.resolve(options.assetOutputDir);
  const assetPublicBase = options.assetPublicBase ?? "/assets/posts";
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

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(assetOutputDir, { recursive: true });
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const sourceFiles = walkFiles(vaultRoot);
  const parsedNotes = sourceFiles.map((file) => parseNote(file, readFileSync(file, "utf8")));
  const prevalidated = parsedNotes.map((note) => {
    const title = asString(note.frontmatter.title) ?? path.basename(note.sourcePath, path.extname(note.sourcePath));
    const slug = asString(note.frontmatter.slug) ?? slugify(title);
    const published = asBoolean(note.frontmatter.published) === true;
    const isInPublishedRoot = isWithin(sourceDir, note.sourcePath);
    return {
      note,
      slug,
      isPublic: published && isInPublishedRoot,
    };
  });
  const noteIndex = createNoteIndex(
    prevalidated.map<NoteIndexEntry>(({ note, slug, isPublic }) => ({
      sourcePath: note.sourcePath,
      slug,
      isPublic,
    })),
  );

  const exportedPosts: ManifestEntry[] = [];
  const skippedPosts: ManifestEntry[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const duplicateSlugs = findDuplicateSlugs(prevalidated.map((item) => item.slug));

  for (const item of prevalidated) {
    if (!isWithin(sourceDir, item.note.sourcePath)) {
      continue;
    }

    const entry = transformNote({
      note: item.note,
      slug: item.slug,
      noteIndex,
      options: {
        vaultRoot,
        outputDir,
        assetOutputDir,
        assetPublicBase,
        privateRoot,
      },
      hasDuplicateSlug: duplicateSlugs.has(item.slug),
      preview: options.preview === true,
    });

    if (entry.outputPath) {
      exportedPosts.push(entry);
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

  if (options.manifestPath) {
    mkdirSync(path.dirname(options.manifestPath), { recursive: true });
    writeFileSync(options.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  if (errors.length > 0 && !options.preview) {
    throw new Error(`Content sync failed with ${errors.length} blocking error(s).`);
  }

  return manifest;
}

function transformNote(input: {
  note: ParsedNote;
  slug: string;
  noteIndex: ReturnType<typeof createNoteIndex>;
  options: {
    vaultRoot: string;
    outputDir: string;
    assetOutputDir: string;
    assetPublicBase: string;
    privateRoot: string;
  };
  hasDuplicateSlug: boolean;
  preview: boolean;
}): ManifestEntry {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { note, slug } = input;
  const sourceText = readFileSync(note.sourcePath, "utf8");
  const state = getState(note);
  const sourceChecksum = checksum(sourceText);
  const published = asBoolean(note.frontmatter.published) === true;

  if (!published && !input.preview) {
    return {
      sourcePath: note.sourcePath,
      slug,
      state,
      sourceChecksum,
      copiedAssets: [],
      rewrittenLinks: [],
      warnings,
      errors: ["Note is inside published/ but missing published: true"],
    };
  }

  const modelResult = createContentModel(note, slug, state, input.hasDuplicateSlug);
  warnings.push(...modelResult.warnings);
  errors.push(...modelResult.errors);

  const linkResult = rewriteWikilinks(modelResult.value?.body ?? note.body, input.noteIndex);
  errors.push(...linkResult.errors);

  const assetResult = rewriteAssets(linkResult.body, {
    sourcePath: note.sourcePath,
    vaultRoot: input.options.vaultRoot,
    outputRoot: input.options.assetOutputDir,
    publicBase: input.options.assetPublicBase,
    slug,
    privateRoot: input.options.privateRoot,
  });
  errors.push(...assetResult.errors);

  if (errors.length > 0 && !input.preview) {
    return {
      sourcePath: note.sourcePath,
      slug,
      state,
      sourceChecksum,
      copiedAssets: assetResult.assets,
      rewrittenLinks: linkResult.references,
      warnings,
      errors,
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
  const outputText = `${frontmatter}${normalizeCallouts(assetResult.body).trimEnd()}\n`;
  const outputPath = path.join(input.options.outputDir, `${slug}.mdx`);
  writeFileSync(outputPath, outputText);

  return {
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
