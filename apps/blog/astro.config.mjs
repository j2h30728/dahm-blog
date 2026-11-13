import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeImages from './src/lib/rehype-images.mjs';
import remarkTypography from './src/lib/remark-typography.mjs';
import { getSiteUrl } from './src/lib/site.ts';

for (const name of ['../../.env.local', '../../.env']) {
  const file = fileURLToPath(new URL(name, import.meta.url));
  if (existsSync(file)) for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export default defineConfig({
  site: getSiteUrl(),
  output: 'static',
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss()] },
  markdown: {
    remarkPlugins: [remarkTypography],
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: false },
    rehypePlugins: [[rehypeSanitize, {
      ...defaultSchema,
      clobberPrefix: '',
      attributes: {
        ...defaultSchema.attributes,
        span: [...(defaultSchema.attributes?.span ?? []), 'style'],
        pre: [...(defaultSchema.attributes?.pre ?? []), 'style', 'className', 'tabIndex'],
        code: [...(defaultSchema.attributes?.code ?? []), 'style', 'className'],
      },
    }], rehypeImages],
  },
});
