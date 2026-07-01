# Personal Tech Blog Stack

Next.js App Router personal tech blog with an Obsidian-first publishing pipeline and a separate private wiki index.

## Architecture

```text
Obsidian vault -> validated content model -> publish manifest -> generated MDX/indexes -> Next.js static export
```

- Public writing starts in `content/public/published`.
- Production export requires both the `published/` source folder and `published: true` frontmatter.
- Public output is generated into `apps/blog/src/content/posts`.
- Public assets are copied into `apps/blog/public/post-assets`.
- Next.js builds the static site into `apps/blog/out`.
- Private notes live under `content/private`.
- Private wiki index output stays under `packages/private-wiki-index/.private-index`.

## Commands

```bash
pnpm check:env
pnpm install
pnpm sync:content
pnpm index:private
pnpm test
pnpm build
```

## Obsidian Vault

By default, the repository-local `content` directory is treated as the vault. Root scripts such as `pnpm dev`, `pnpm sync:content`, and `pnpm build` pin that local vault with `--vault content` so shell-level Obsidian environment variables cannot accidentally rewrite generated blog artifacts.

To use a real Obsidian vault directly, point the content-sync package CLI at it with environment variables:

```bash
export OBSIDIAN_VAULT_PATH="/path/to/Obsidian"
export OBSIDIAN_PUBLIC_SOURCE="$OBSIDIAN_VAULT_PATH/public/published"
export OBSIDIAN_PRIVATE_INCLUDE="private"
export OBSIDIAN_PRIVATE_EXCLUDE="public"
```

Then run the package-level sync command so those environment variables are honored:

```bash
pnpm --filter @dahm-blog/content-sync sync
pnpm index:private
```

Recommended vault folders:

```text
Obsidian/
  public/
    published/
    assets/
  private/
```

## Local Toolchain

This project pins Node 24.17.0 and pnpm 10.34.4 in `package.json`, `.nvmrc`,
and `.node-version`. The install path also runs `pnpm check:env`, so the
project fails fast when Node or the package manager drifts.

For nvm-compatible shells:

```bash
nvm use
```

For Corepack:

```bash
corepack enable
corepack prepare pnpm@10.34.4 --activate
```

For Volta, enable pnpm support before installing the pinned package manager:

```bash
export VOLTA_FEATURE_PNPM=1
volta install node@24.17.0
volta install pnpm@10.34.4
```

If `pnpm` still resolves to an nvm/Corepack path instead of Volta, put Volta
before nvm in your shell:

```bash
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"
```

Then open a new terminal and verify:

```bash
which node
which pnpm
node --version
pnpm --version
pnpm check:env
```

If local Corepack has pnpm signature issues, run the pinned pnpm version
through npm after switching to Node 24:

```bash
npm exec --yes pnpm@10.34.4 -- install
npm exec --yes pnpm@10.34.4 -- test
npm exec --yes pnpm@10.34.4 -- build
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
