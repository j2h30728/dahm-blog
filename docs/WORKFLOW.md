# Publishing Workflow

Obsidian에서 글을 써서 Vercel에 배포하기까지의 전체 흐름을 다룹니다.

## TL;DR

```bash
# Obsidian에서 글을 쓴 뒤 (vault/public/published/ 에 .md 저장)
pnpm migrate:vault        # 1. vault → repo 로 글 복사
pnpm sync:content         # 2. repo(.md) → posts/(.mdx) 변환
git add -A && git commit  # 3. 커밋
git push                  # 4. 배포 (pre-push 훅이 누락 자동 검사)
```

## 왜 이 구조인가

배포는 Vercel CI에서 일어나는데, **Vercel은 로컬 Google Drive vault에 접근할 수 없습니다.**
그래서 repo 안의 `content/public/published/` 가 빌드의 단일 진실 공급원(source of truth)이 됩니다.
vault는 로컬 작업용 원본이고, repo로 옮긴 글만 배포됩니다.

```
┌─────────────────────────────────────────────────────────────────┐
│  내 맥 (로컬)                                                    │
│                                                                  │
│  Obsidian vault (Google Drive)                                   │
│  └─ public/published/*.md   ← 사람이 글을 쓰는 곳                 │
│         │                                                        │
│         │ pnpm migrate:vault                                     │
│         ▼                                                        │
│  repo content/public/published/*.md   ← 복사된 원본              │
│         │                                                        │
│         │ pnpm sync:content                                       │
│         ▼                                                        │
│  repo apps/blog/src/content/posts/*.mdx   ← 변환된 빌드 입력     │
│         │                                                        │
│         │ git push                                               │
│         ▼                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
┌─────────▼────────────────────────────────────────────────────────┐
│  Vercel CI                                                       │
│                                                                  │
│  git clone (repo content/ 만 있음, vault 없음)                    │
│         │                                                        │
│         │ pnpm build:blog  (= sync:content + next build)          │
│         ▼                                                        │
│  repo content/ 를 읽어 .mdx 생성 → 정적 사이트 배포               │
└──────────────────────────────────────────────────────────────────┘
```

## 단계별 상세

### 1. 글 작성 (Obsidian)

`<vault>/public/published/` 에 Markdown 파일을 만듭니다. frontmatter가 필요합니다:

```yaml
---
title: 글 제목
slug: url-slug
description: 한 줄 요약
date: 2026-08-05
tags: [react, nextjs]
topic: frontend
published: true        # true 여야 공개됨
# series: Frontend Architecture    (선택)
# seriesOrder: 1                   (선택)
---
```

### 2. vault → repo 복사

```bash
pnpm migrate:vault
# 미리보기:
pnpm migrate:vault -- --dry-run
# vault 경로 직접 지정:
pnpm migrate:vault -- --vault "/path/to/Obsidian"
```

`<vault>/public/published/*.md` 와 `<vault>/public/assets/*` 를
repo의 `content/public/published/`, `content/public/assets/` 로 복사합니다.

### 3. MDX 변환

```bash
pnpm sync:content
```

repo의 `.md` (Obsidian 문법)를 `.mdx` (웹 표준)로 변환합니다:

- `[[위키링크]]` → `[링크](/posts/slug/)`
- `![[임베드]]` → `<img src="/post-assets/..." />`
- 에셋 경로 재작성
- `apps/blog/src/content/posts/*.mdx` 생성

### 4. 커밋 & 푸시

```bash
git add -A
git commit -m "[feat](blog): 새 글 추가"
git push
```

`git push` 시 **pre-push 훅**이 자동 실행됩니다.

## 자동 검사: pre-push 훅

push하기 전에 vault와 repo를 비교해서, **vault에만 있고 repo엔 없는 글이 있으면 push를 차단**합니다.

```
$ git push

⚠️  pre-push: 1 vault post(s) missing from the repo:

  - 새로-쓴-글.md

The repo's content/public/published/ is the source of truth for Vercel.
Run `pnpm migrate:vault` to copy these in, then re-stage and push.
To bypass this check once: SKIP_VAULT_CHECK=1 git push
```

**동작 조건:**
- `OBSIDIAN_VAULT_PATH` 가 설정되어 있고 vault에 접근 가능할 때만 실행
- CI나 다른 맥처럼 vault가 없는 환경에선 조용히 스킵
- 긴급 우회: `SKIP_VAULT_CHECK=1 git push`

## 디렉토리 역할

| 디렉토리 | 역할 | 확장자 | 누가 만드나 | 고쳐도 되나 |
|----------|------|--------|------------|------------|
| `<vault>/public/published/` | Obsidian 원본 | `.md` | 사람이 직접 | ✅ 여기서 작성 |
| `content/public/published/` | repo 진실 소스 | `.md` | `migrate:vault` 복사 | ⚠️ 직접 말고 migrate 로 |
| `apps/blog/src/content/posts/` | 빌드 입력 (생성물) | `.mdx` | `sync:content` 생성 | ❌ 고치면 다음 sync에 날아감 |

> **⚠️ 중요:** 글을 수정할 땐 항상 vault 원본이나 `content/public/published/`(.md)를 고치세요.
> `posts/`(.mdx)를 고치면 다음 `sync:content` 실행 시 덮어쓰기 때문에 날아갑니다.

## 명령어 요약

| 명령어 | 하는 일 |
|--------|---------|
| `pnpm migrate:vault` | vault 글/에셋 → repo 복사 |
| `pnpm sync:content` | repo(.md) → posts/(.mdx) 변환 |
| `pnpm build:blog` | sync + Next.js 빌드 (Vercel이 실행) |
| `pnpm dev` | sync + 로컬 개발 서버 |
| `SKIP_VAULT_CHECK=1 git push` | pre-push 검사 일회 우회 |

## 자주 묻는 질문

**Q: Obsidian에서 글을 쓰고 바로 push하면 안 되나요?**
A: `migrate:vault`를 건너뛰면 repo에 글이 없어서 Vercel 빌드에 누락됩니다. pre-push 훅이 이걸 잡아주지만, 훅이 없다면 글이 배포되지 않습니다.

**Q: 글을 수정할 땐 어디를 고치나요?**
A: vault 원본(`<vault>/public/published/*.md`)을 고치고 다시 `migrate:vault` → `sync:content` 순으로 실행하세요.

**Q: Google Drive가 안 마운트된 환경에선?**
A: `OBSIDIAN_VAULT_PATH`가 가리키는 경로가 없으면 pre-push 훅이 자동으로 스킵됩니다. 이땐 repo content/를 직접 편집해도 됩니다.
