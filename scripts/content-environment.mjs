import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));

export function loadContentEnvironment() {
  // Existing process variables win. Loading .env.local first preserves its priority.
  for (const name of ['.env.local', '.env']) {
    const file = path.join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export function contentOptions() {
  loadContentEnvironment();
  const source = process.env.OBSIDIAN_BLOG_DIR?.trim();
  return {
    ...(source ? { sourceDir: path.resolve(root, source) } : {}),
    contentDir: path.join(root, 'apps/blog/src/content'),
    assetsDir: path.join(root, 'apps/blog/public/blog-assets'),
  };
}
