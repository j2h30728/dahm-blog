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

## Obsidian Vault

By default, the repository-local `content` directory is treated as the vault. To use a real Obsidian vault, point the CLI at it with environment variables:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/Obsidian"
export OBSIDIAN_PUBLIC_SOURCE="$OBSIDIAN_VAULT_PATH/public/published"
export OBSIDIAN_PRIVATE_INCLUDE="private"
export OBSIDIAN_PRIVATE_EXCLUDE="public"
```

Then the normal commands use that vault:

```bash
pnpm sync:content
pnpm index:private
pnpm dev
```

Recommended vault folders:

```text
Obsidian/
  public/
    published/
    assets/
  private/
```

If local Corepack has pnpm signature issues, run the pinned pnpm version through npm:

```bash
npm exec --yes pnpm@11.8.0 -- install
npm exec --yes pnpm@11.8.0 -- test
npm exec --yes pnpm@11.8.0 -- build
```

## Volta

This project pins Node 24 LTS with Volta and uses `packageManager: pnpm@11.8.0`.

```bash
volta install node@24.17.0
volta install pnpm@11.8.0
```

If `pnpm` still resolves to an nvm/Corepack path, put Volta before nvm in your shell:

```bash
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"
```

Then open a new terminal and verify:

```bash
which pnpm
pnpm --version
node --version
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
