import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';

interface SnapshotEntry extends Record<string, unknown> {
  kind: 'posts' | 'notes';
  slug: string;
  file: string;
}

/** Rebuild each collection from the complete public snapshot, including empty collections. */
export function snapshotLoader(kind: SnapshotEntry['kind']): Loader {
  return {
    name: `obsidian-${kind}`,
    async load({ config, store, parseData, renderMarkdown, generateDigest }) {
      const manifestUrl = new URL('./src/content/export-manifest.json', config.root);
      const contentRoot = new URL('./src/content/', config.root);

      async function sync() {
        const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as { version: number; entries: SnapshotEntry[] };
        if (manifest.version !== 1 || !Array.isArray(manifest.entries)) throw new Error('공개 snapshot 형식 오류');
        const pending = [];
        for (const entry of manifest.entries.filter(entry => entry.kind === kind)) {
          if (entry.file !== `${kind}/${entry.slug}.md` || /[/\\]/.test(entry.slug)) throw new Error('공개 snapshot 문서 경로 오류');
          const fileUrl = new URL(encodeURI(entry.file), contentRoot);
          const source = await readFile(fileUrl, 'utf8');
          const filePath = path.relative(fileURLToPath(config.root), fileURLToPath(fileUrl));
          const data = await parseData({ id: entry.slug, data: entry, filePath });
          const rendered = await renderMarkdown(source, { fileURL: fileUrl });
          const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
          pending.push({ id: entry.slug, data, body, filePath, rendered, digest: generateDigest(source) });
        }
        // Clear only after every entry rendered successfully; empty snapshots also remove old entries.
        store.clear();
        for (const entry of pending) store.set(entry);
      }

      await sync();
    },
  };
}
