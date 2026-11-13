# Obsidian 작성·발행

## 원본과 공개 사본

원본은 Obsidian vault의 `blog` 폴더입니다. 원본 파일은 사이트에서 수정하지 않습니다.

```text
blog/
├─ posts/   # 정리된 글
├─ notes/   # 짧은 메모
└─ assets/  # 첨부
```

`publish: true`인 Markdown만 사이트로 내보냅니다. YAML의 boolean `true`만 공개이며, 누락·`false`·문자열 `"true"`는 공개하지 않습니다. 비공개 항목의 제목과 첨부도 내보내지 않습니다. 공개 글이 참조하는 첨부는 공개 파일이므로, 이미지 안에 포함된 정보도 발행 전에 확인합니다.

저장소에는 공개 사본만 둡니다.

- `apps/blog/src/content/posts/`, `notes/`: 공개 Markdown
- `apps/blog/src/content/export-manifest.json`: 파일 검증과 배포용 manifest
- `apps/blog/public/blog-assets/`: 공개 문서가 참조한 첨부

위 경로는 동기화가 관리하므로 직접 수정하지 않습니다. 글·메모를 비공개로 바꾸거나 삭제하면 다음 동기화 때 공개 사본과 더 이상 사용하지 않는 첨부가 제거됩니다. Notion API, Notion 이미지 만료 처리, S3 업로더는 사용하지 않습니다.

사이트의 상위 메뉴는 **글 · 메모 · 소개**입니다. 홈과 `/posts/`는 기술·일상 글 전체를 보여주고, 전체(`/posts/`)·기술(`/tech/`)·일상(`/life/`) 분류 탭으로 이동할 수 있습니다. 분류를 바꿔도 검색어는 유지되며, 검색을 해제하면 현재 분류의 전체 글을 보여줍니다. 메모는 글 목록에 섞지 않습니다. 과거 `/posts/?category=life` 주소는 일상 목록으로 연결합니다.

Obsidian의 `blog/notes/`는 사이트에서 **메모**로 표시합니다. 기록 하나당 파일 하나를 작성하며 `/notes/`와 `/notes/<slug>/` 주소를 유지합니다. 메모 목록은 한국시간 기준 월별로 날짜·제목·태그를 보여줍니다. 태그 필터와 검색을 함께 사용하면 두 조건을 모두 만족하는 기록만 표시합니다. 검색 해제는 선택 태그를 유지하고, 태그의 전체 버튼은 검색어를 유지합니다.

메모에는 별도 카테고리를 두지 않고 태그를 선택적으로 붙입니다. `개발`, `독서`, `생각`, `도구` 등에서 필요한 태그 1~3개로 시작하면 됩니다. 필터는 공개 메모에 실제 사용한 태그로 자동 생성하며, 전체·태그·검색 결과의 건수는 메모 화면에 표시하지 않습니다. 글 목록의 분류 건수는 유지합니다.

## 로컬 설정

Node 24와 저장소의 pnpm 버전을 사용합니다. `.env.local`에 아래 값을 설정합니다. 이 파일은 Git에서 제외됩니다.

```dotenv
OBSIDIAN_BLOG_DIR=/absolute/path/to/Obsidian/blog
PUBLIC_SITE_URL=https://your-blog.example
```

기존 프로세스 환경변수가 가장 우선하고, 다음은 `.env.local`, `.env` 순서입니다. 개인 PC의 절대 경로를 Vercel에 설정하지 않습니다.

```bash
pnpm install
pnpm dev
```

`pnpm dev`는 최초 동기화 후 Obsidian 폴더 변경을 감시합니다. 원본을 저장하면 공개 사본을 갱신하고 Astro 개발 서버를 자동으로 다시 시작합니다. 빈 메모 목록에서 첫 메모를 공개하거나 마지막 공개 메모를 숨겨도 이전 데이터가 남지 않도록 처리합니다. 동기화 오류가 생기면 터미널에 원인이 표시되고, 원본을 고쳐 저장하면 다시 시도합니다.

개발 서버 없이 공개 사본만 갱신하려면:

```bash
pnpm sync:content
```

## 글과 메모 속성

```yaml
---
title: 표시할 제목
publish: false
date: 2026-11-12
slug: stable-url
section: 기술
tags:
  - React
summary: 선택적으로 작성하는 설명
---
```

- `title`: 제목. 비어 있으면 파일명을 사용합니다.
- `publish`: 공개 여부. 초안은 `false`로 둡니다.
- `date`: 최초 발행일. 공개할 때 유효한 날짜가 필요합니다.
- `slug`: 최초 공개 후 유지합니다. 글은 `/posts/slug/`, 메모는 `/notes/slug/`입니다. 글 제목이나 파일명을 바꾸더라도 `slug`를 유지하면 주소를 보존합니다.
- `section`: 글의 `기술` 또는 `일상` 분류입니다. 메모는 별도의 메모 목록에 표시합니다.
- `tags`: 선택 속성. 없는 경우 빈 목록입니다.
- `summary`: 선택 속성. 생략하면 본문 텍스트에서 설명을 만듭니다.

기존 `updated`, `series`, `seriesOrder`도 지원합니다. 비공개 초안에는 발행 속성을 모두 채울 필요가 없습니다. 같은 종류에서 중복된 slug, 잘못된 공개 메타데이터, 누락된 첨부는 오류로 중단합니다. 기존 정상 공개 사본은 실패한 동기화로 교체하지 않습니다.

현재 메모가 모두 비공개라면 `/notes/`에는 빈 상태가 표시됩니다. 메모를 작성하고 `publish: true`로 바꾸면 다음 동기화에 포함됩니다.

## Obsidian 템플릿

기본 Templates 기능의 `_templates` 폴더에 다음 두 템플릿을 추가했습니다. 저장소에도 [글 템플릿](templates/blog-post.md)과 [메모 템플릿](templates/blog-note.md) 사본을 둡니다.

- **블로그 글**: `blog/posts/`에서 새 파일을 만들고 사용합니다. `section`은 기술 또는 일상으로 정합니다.
- **블로그 메모**: `blog/notes/`에서 새 파일을 만들고 사용합니다. 카테고리·요약 없이 바로 작성할 수 있습니다.

Obsidian 명령 팔레트에서 **Templates: Insert template(템플릿 삽입)**을 실행해 선택합니다. 본문을 작성할 위치에서 삽입하세요. 추가 플러그인은 필요 없고, 기존 템플릿과 설정은 유지합니다.

두 템플릿은 `publish: false`로 시작하고 날짜는 삽입한 날로 채워집니다. `title`이 비어 있으면 파일명을 제목으로 사용하므로, 따옴표가 포함된 파일명도 템플릿의 YAML을 깨뜨리지 않습니다. 별도의 표시 제목이 필요하면 `title`에 입력합니다. 태그는 선택 사항이며 강제로 붙이지 않습니다.

최초 발행 전에는 `slug`에 유지할 고정 주소를 입력하세요. 비워 두면 파일명에서 주소를 만들지만, 나중에 파일명을 바꾸면 주소도 달라질 수 있습니다. 템플릿의 `date`는 작성일로 채워지므로 실제 발행일이 다르면 첫 발행 전에 조정하고, 발행한 뒤에는 유지합니다.

작성 후 `publish: true`로 바꾸고 `pnpm publish:blog`를 실행하면 됩니다.

## 이미지와 링크

Obsidian에서 이미지 모서리를 조절해 저장한 크기를 읽습니다.

```markdown
![[blog/assets/screenshot.png|360]]
![[blog/assets/screenshot.png|360x480]]
```

너비만 지정하면 원래 비율을 유지하며, 작은 화면에서는 본문 너비를 넘지 않습니다. 너비·높이를 모두 지정한 값도 전달합니다. 이미지 클릭·키보드로 확대할 수 있습니다. 코드 예제 안의 이미지 문법은 변환하지 않습니다. 일반 Markdown의 상대 이미지·첨부 링크도 지원합니다.

공개 노트끼리의 위키 링크와 상대 Markdown 링크는 사이트 주소로 연결합니다. 비공개 노트를 가리키는 내부 링크는 글자로 표시하며 해당 노트나 첨부를 함께 게시하지 않습니다. 일반 외부 웹 링크는 유지합니다.

첨부 경로는 원본 `assets` 안으로 제한하고, 외부 경로나 symlink를 통한 원본 밖 파일 접근은 허용하지 않습니다.

## 빌드와 배포

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm test:browser
```

`build`는 `OBSIDIAN_BLOG_DIR`이 설정된 PC에서는 먼저 동기화한 다음 Astro 정적 HTML을 만듭니다. 설정이 없으면 저장소에 포함된 공개 사본과 manifest를 검증한 뒤 빌드합니다. 사본이 없거나 손상됐으면 실패합니다. 명시한 원본 경로가 잘못됐을 때 과거 사본으로 조용히 대체하지 않습니다.

출력은 `apps/blog/dist`입니다. Vercel도 이 디렉터리를 배포합니다. 배포 서버는 Google Drive를 읽지 않으므로, 공개 사본을 갱신하고 코드와 함께 저장소에 반영해야 다음 Git 배포에 포함됩니다. Google Drive 동기화 자체가 배포를 실행하지는 않습니다.

## 한 명령으로 발행

최초 Astro 전환 코드와 발행 스크립트는 먼저 별도로 커밋·push하고 Vercel의 Git 배포 연결을 확인합니다. 이 초기 반영은 발행 명령이 대신하지 않습니다.

이후 글·메모의 `publish: true` 설정과 본문을 저장한 뒤 프로젝트에서 실행합니다.

```bash
pnpm publish:blog
```

다음 순서로 처리합니다.

1. 현재 브랜치·upstream·staging·미커밋 변경과 원격 이력을 확인합니다.
2. 공개 문서와 참조 첨부를 동기화합니다.
3. snapshot과 Astro 정적 빌드를 검증합니다. 공유 이미지는 실제 배포 빌드에서 생성합니다.
4. `apps/blog/src/content/`와 `apps/blog/public/blog-assets/`의 변경만 커밋합니다.
5. `origin/main`에 일반 push합니다. 이후 Vercel Git 배포가 진행됩니다. 이 명령은 Vercel 배포 성공까지 기다리지는 않습니다.

자동 커밋 제목은 `[docs](blog): 공개 글·메모 변경 반영`입니다. 비공개 전환으로 생기는 공개 사본과 첨부 삭제도 함께 반영합니다. 변경이 없으면 새 커밋과 push를 생략합니다.

기본 대상은 `origin/main`이며 `.env.local`의 `BLOG_PUBLISH_REMOTE`, `BLOG_PUBLISH_BRANCH`로 변경할 수 있습니다. 현재 브랜치와 설정된 upstream이 정확히 일치해야 하며, 운영 사이트를 갱신하려면 이 브랜치를 Vercel Production branch와 맞춥니다.

```bash
pnpm publish:blog --dry-run
pnpm publish:blog --help
```

`--dry-run`은 로컬 Git 준비상태와 예정 절차만 확인합니다. 원격 fetch, 동기화, 빌드, staging, 커밋, push를 하지 않으며 실제 콘텐츠 변경 건수는 계산하지 않습니다. 원격 상태는 실제 실행 시 갱신합니다.

안전하게 발행하기 위한 조건:

- 이미 스테이징한 변경, 사이트 코드의 미커밋·새 파일이 있으면 중단합니다. 기존 변경을 자동으로 포함하거나 되돌리지 않습니다.
- 미push 커밋에 사이트 코드가 있거나 원격이 앞선 경우, merge/rebase 진행 중이면 중단합니다. 자동 pull·rebase·force push는 하지 않습니다.
- 원본·빌드 검증에 실패하면 Git staging·커밋·push를 하지 않습니다. 동기화된 공개 사본은 작업 폴더에서 확인할 수 있습니다.
- 커밋 hook 등의 실패 시 staging은 유지하고 해제 명령을 안내합니다. 원인을 해결하고 해당 경로의 staging을 해제한 뒤 다시 실행합니다.
- push 실패 시 로컬 콘텐츠 커밋은 유지합니다. 연결·권한 문제를 해결한 후 같은 명령을 다시 실행하면 이미 만든 콘텐츠 커밋을 중복 생성하지 않고 재시도합니다.
- 중복 실행은 Git 디렉터리의 `blog-publish.lock`으로 차단합니다. 강제 종료로 lock이 남았다면 실행 중인 발행이 없는지 확인한 다음 정리합니다.

이번 기능 구현 중에는 실제 프로젝트의 커밋·push·배포를 수행하지 않습니다. 발행 테스트의 Git 쓰기는 임시 저장소와 로컬 bare remote에만 수행합니다.

## 댓글과 통계

Giscus는 기존 저장소와 카테고리를 사용합니다. 글은 `post:<slug>`에 연결하므로 기존 댓글을 유지하려면 slug를 유지합니다. 메모는 `note:<slug>`로 구분합니다. `GISCUS_ENABLED=false`로 끌 수 있습니다.

GA4는 `PUBLIC_GA_MEASUREMENT_ID`로 설정합니다. 기존 `NEXT_PUBLIC_GA_MEASUREMENT_ID`도 호환용으로 읽습니다. Vercel Production에서만 활성화하며 로컬과 Preview에서는 수집하지 않습니다. 정적 사이트이므로 설정 변경 후 다시 빌드해야 합니다.
