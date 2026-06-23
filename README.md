# Personal Tech Blog Stack

Astro-based personal tech blog scaffold with an Obsidian-first publishing pipeline and a separate private wiki index.

## Architecture

```text
Obsidian vault -> validated content model -> publish manifest -> exported public bundle -> Astro render
```

- Public writing starts in `content/public/published`.
- Production export requires both the `published/` source folder and `published: true` frontmatter.
- Public output is generated into `apps/blog/src/content/posts`.
- Public assets are copied into `apps/blog/public/assets/posts`.
- Private notes live under `content/private`.
- Private wiki index output stays under `packages/private-wiki-index/.private-index`.

## Commands

```bash
pnpm install
pnpm sync:content
pnpm index:private
pnpm test
pnpm build
```

If local Corepack has pnpm signature issues, run the pinned pnpm version through npm:

```bash
npm exec --yes pnpm@9.15.5 -- install
npm exec --yes pnpm@9.15.5 -- test
npm exec --yes pnpm@9.15.5 -- build
```

## Public Blog MVP

- Posts
- Tags
- Series
- Static search
- Related posts
- Table of contents for posts with `h2`/`h3` headings

## Private Wiki MVP

The private wiki indexer builds a local JSON index with deterministic local hash embeddings. It is intentionally separate from the public blog and refuses to write into `apps/blog/public`.
