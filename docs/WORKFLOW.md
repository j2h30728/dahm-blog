# Notion 게시 워크플로

게시 원본은 기존 `😎 blog` DB 하나입니다. 저장소 Markdown·샘플 글·이전 생성물을 게시 입력으로 읽지 않습니다.

## 설정

Notion 개발자 포털에서 내부 연결을 만들고 `Read content` 권한을 부여한 뒤 `Content access`에 기존 DB를 연결합니다.

```dotenv
NOTION_TOKEN=발급받은_API_토큰
NOTION_DATABASE_ID=308e8c228b6581a7ad3ac188b53210d0
NOTION_DATA_SOURCE_ID=308e8c22-8b65-81ce-b792-000b7eb2b8bf
PUBLIC_SITE_URL=https://실제-블로그-도메인
```

루트 `.env.local` 또는 `.env`, Vercel 환경변수에 입력합니다. 우선순위는 `process.env > .env.local > .env`입니다. 토큰은 서버/빌드에서만 사용하며 Git과 채팅에 넣지 않습니다. 데이터 소스 ID가 있으면 직접 조회하고, DB ID만 있으면 단일 데이터 소스를 찾아 사용합니다.

## 작성 속성

| Notion 속성 | 블로그 값 | 조건 |
| --- | --- | --- |
| `title` | 제목 | 필수 |
| `summary` | description | 필수 |
| `date` | 발행일 | 필수 |
| `tags` | 태그 | 한 개 이상 |
| `slug` | /posts/slug/ | 필수, 문자·숫자·점·밑줄·하이픈의 단일 경로 |
| `category` | topic | 비어 있으면 general |
| `section` | 글 분류 | 선택, `기술`/`tech` 또는 `일상`/`life`; 없거나 비어 있으면 `tech` |
| `status` | 공개 여부 | published만 게시 |
| `type` | 글 종류 | post만 게시 |
| `series`, `seriesOrder` | 시리즈·순서 | 선택 |
| 페이지 수정 시각 | updated | API last_edited_time |

`author`, `thumbnail` 속성은 현재 UI에서 사용하지 않습니다. 로컬 파일의 frontmatter나 별도 페이지 ID 예외 매핑도 사용하지 않습니다. URL 유지를 위해 세 기존 글의 DB slug를 `rsc-dot-notation`, `esmodule-singleton`, `axios-cancel`로 정리했습니다.

Notion DB의 `section` 선택 속성에서 `기술` 또는 `일상`을 선택합니다. 비어 있는 글은 기술 글로 동기화됩니다. API에서는 `tech`와 `life` 값도 지원하며, 지원하지 않는 선택값은 잘못된 분류를 조용히 게시하지 않도록 동기화 오류로 처리합니다. 기존 `category`는 주제(`topic`) 용도이며 글 분류와 별개입니다.

## 동기화와 확인

```bash
pnpm dev
# 서버가 실행 중일 때 글 변경 반영:
pnpm sync:content
```

첫 명령은 API 동기화에 성공해야 개발 서버를 시작합니다. 공개 글이 0개이면 빈 목록을 생성합니다. 비공개·삭제한 글은 이전 MDX·인덱스·에셋에서 제거합니다. API 실패 시 과거 글을 읽어 대신 게시하지 않습니다.

목록·태그·시리즈·검색·RSS·사이트맵은 모두 같은 공개 글 메타데이터를 사용합니다. 표준 Markdown 내부 링크로 backlinks와 링크 미리보기를 만들고, 코드 예제의 링크는 제외합니다. 코드 복사·목차 활성화도 유지합니다.

탑메뉴는 `기술`(`/tech/`)·`일상`(`/life/`)·`소개`(`/about/`)이며, 로고는 전체 공개 글을 발행일 최신순으로 보여주는 홈(`/`)으로 이동합니다. 본문에 중복 분류 탭은 표시하지 않습니다. 상세 글에서도 해당 분류 메뉴가 활성화됩니다.

홈과 홈 검색 결과에서는 글 날짜 옆에 작은 `기술`·`일상` 분류를 표시합니다. 분류별 목록·태그·시리즈 목록에서는 중복 표시하지 않습니다.

헤더·본문·푸터는 `ui-classes.ts`의 공통 `pageFrame`을 사용합니다. 최대 너비는 980px, 좌우 여백은 기본 24px·모바일 18px이며 목록에 별도 좁은 최대 너비를 두지 않습니다. 페이지 제목은 공통 `pageHeading`으로 맞추고 소개·글 상세도 작은 글자, 얇은 구분선, 단순한 텍스트 링크를 사용합니다. 상세 본문과 목차는 같은 전체 프레임 안에서 나눕니다.

검색은 홈에서는 전체 글, 기술·일상 목록과 상세 글에서는 해당 분류를 대상으로 합니다. 검색 해제는 현재 목록 범위를 유지하며, 메뉴·로고로 이동하면 검색어와 검색창을 초기화합니다. 소개·태그·시리즈에서 시작한 검색은 전체 글을 대상으로 합니다.

로고는 문서를 새로고침하지 않고 검색어 없는 `/` 홈으로 이동합니다. 같은 홈에서는 URL 상태를 갱신하고, 상세 글을 거쳐 돌아올 때도 도착한 홈 주소의 검색어를 정리해 전체 목록을 복원합니다. 현재 테마와 화면 배경을 유지하며, 뒤로가기로 과거 검색 기록을 다시 볼 수 있습니다.

기존 `/posts/`는 기술 기본 목록으로, `/posts/?category=life`는 일상 목록으로 계속 열 수 있습니다. 글 상세의 `/posts/:slug/` 주소는 유지합니다. 홈 canonical은 `/`, 새 분류 목록은 각각 `/tech/`, `/life/`이며, Vercel의 과거 `/`→`/posts/` 리다이렉트는 제거했습니다.

태그 URL은 동기화가 생성한 `tagSlugs`, 시리즈 URL은 `seriesSlug`를 앱이 그대로 사용합니다. Unicode 문자를 보존하며 `C++`와 `C#`처럼 서로 다른 이름이 같은 URL로 정규화되거나 이름이 빈 URL을 만들면 출력 전에 오류로 중단합니다.

## 본문과 미디어

CJK 문장과 문장부호가 붙어 문자로 남은 `**강조(설명)**에서는` 형태는 원문과 AST text가 일치할 때만 강조로 보완합니다. escape된 기호와 코드·링크 주소는 재해석하지 않습니다.

- 제목, 단락, 목록, 인용, 링크, 코드, 이미지와 일반 표를 변환합니다.
- 본문 이미지는 클릭·키보드로 확대합니다. ESC·바깥 영역·닫기 버튼으로 닫으며, 모바일 화면 안에 원래 비율로 표시합니다. 닫으면 원래 이미지로 포커스와 배경 스크롤 상태를 복원합니다. 이미지 링크도 확대를 지원하고 보조키 클릭은 원래 링크 동작을 유지합니다.
- 이미지 캡션 끝에 `로그인 화면 {width=360}`처럼 적으면 본문에서 가로 360px로 표시하고, 작은 화면에서는 부모 너비 안으로 축소합니다. 높이는 원래 비율을 유지합니다. 크기 표기는 블로그 캡션·대체 텍스트·확대 안내에서 제거하고 `로그인 화면`만 표시합니다. `{width=360}`만 적으면 캡션은 표시하지 않습니다. 너비 생략 시 기존 자동 크기를 유지하고 설명이 있으면 이미지 아래에 표시합니다. 너비는 단위 없는 1~10000의 정수(px)만 지원하며 잘못된 표기는 텍스트로 보존합니다. 노션에서는 표기가 그대로 보이며, 블로그의 다음 동기화·빌드 때 반영됩니다.
- 본문의 첫 비어 있지 않은 줄이 메타데이터 제목과 같은 H1이면 중복 표시를 막기 위해 해당 H1 하나만 제거합니다. 다른 H1과 코드 예제의 `#`은 보존합니다.
- Notion의 단일 개행은 화면 줄바꿈으로, 빈 줄은 문단 구분으로 표시합니다. 의도적으로 escape한 Markdown 문자는 원문 그대로 보존합니다.
- 본문 요소와 코드 강조는 밝은 테마와 어두운 테마에서 같은 구조·간격 정책을 사용하며 색상만 각 테마에 맞춥니다.
- callout은 강조 제목·본문, toggle은 펼친 제목·본문으로 표시합니다.
- PDF·오디오·영상은 일반 MDX 미디어로 표시합니다.
- 병합/중첩 표, 표 안의 fenced code, columns 등 미지원 XML·잘린 본문은 오류로 중단합니다. 수식 전용 렌더러는 추가하지 않습니다.
- Notion/S3의 임시 첨부 URL은 HTTPS로 내려받아 영속화합니다. 외부 이미지 URL은 유지합니다. 파일별 최대 크기는 25MB입니다.
- Notion에서 생성한 코드 예제는 보존하고, 일반 텍스트의 JSX·중괄호는 실행되지 않도록 이스케이프합니다.

임시 본문 처리·다운로드 파일은 `.content-sync/notion-*`에 만들고 실행 후 삭제합니다. 최종 MDX는 `apps/blog/src/content/posts`, 첨부는 `apps/blog/public/post-assets`에 생성합니다. 첨부 파일명 `notion-<해시>.<확장자>`는 Git에서 제외됩니다.

동기화는 전체 결과를 준비한 뒤 생성물을 교체합니다. 교체 도중 오류가 생기면 이전 생성물을 복원하며, 복원까지 실패하면 복구용 백업 경로를 표시합니다.

## 배포

이미지 사전 변환과 S3·CloudFront의 실행 모드·개인 계정 인증·전환 검증은 [이미지 CDN 운영](./IMAGE-CDN.md)을 참고합니다.

Vercel의 빌드 명령 `pnpm build:blog`가 최신 공개 글을 가져옵니다. Notion 변경으로 배포를 자동 시작하는 웹훅은 아직 없습니다. 운영 반영은 Vercel 재배포 또는 새 Git 배포로 진행합니다.

API·출력 검사 중에는 `--out`, `--assets`, `--manifest`, `--public-index`, `--public-post-index`, `--search-index`, `--post-module-map`으로 생성 경로만 바꿀 수 있습니다. 로컬 파일 게시 모드·vault·preview 입력은 지원하지 않습니다.

## Google Analytics 4

GA4는 `NODE_ENV=production`과 `VERCEL_ENV=production`이고 `NEXT_PUBLIC_GA_MEASUREMENT_ID`가 있을 때만 활성화됩니다. 로컬 개발·로컬 정적 빌드·Vercel Preview에서는 수집하지 않습니다. ID를 생략하거나 공백만 입력하면 GA 없이 정상 동작합니다.

### GA4 웹 스트림 설정

1. [Google Analytics](https://analytics.google.com/)에서 사용할 계정과 GA4 속성을 선택합니다. 처음 생성한다면 보고 시간대를 대한민국(Asia/Seoul)으로 설정합니다.
2. **관리 → 데이터 스트림 → 웹**에서 실제 운영 도메인의 스트림을 생성하거나 기존 스트림을 엽니다.
3. 스트림 세부정보의 `G-...` 형태 **측정 ID**를 확인합니다. 현재 블로그에 사용할 ID는 `G-VEGH5K4QQF`입니다.
4. **향상된 측정 → 페이지 조회 → 고급 설정**에서 페이지 로드와 브라우저 기록 이벤트 기반 페이지 변경을 모두 켭니다. 내부 링크 이동과 뒤로가기도 이 설정으로 수집합니다.
5. 기본 스크롤(페이지의 90% 도달)과 외부 링크 클릭 측정도 켭니다. 방문자·유입 경로·글별 조회수는 GA4 보고서에서 확인합니다.

공통 레이아웃의 `GoogleAnalytics` 컴포넌트가 hydration 이후 Google tag를 한 번 초기화합니다. 페이지뷰는 GA4 자동 수집을 사용하므로 별도 수동 `page_view` 전송이나 동일 스트림의 태그를 추가하면 중복 집계될 수 있습니다.

### Vercel 활성화

[dahm-blog 프로젝트](https://vercel.com/j2h30728s-projects/dahm-blog)의 **Settings → Environment Variables**에서 아래 값을 **Production** 환경에만 등록합니다.

```dotenv
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-VEGH5K4QQF
```

측정 ID는 브라우저에 공개되는 식별자이며 API 비밀키가 아닙니다. 정적 내보내기에서는 빌드 시 ID와 활성화 여부가 결정되므로 코드 반영과 환경변수 저장 후 새 Production 배포가 필요합니다. 비활성화할 때도 변수를 지운 뒤 다시 배포합니다. Production 빌드 산출물을 다른 도메인에 복사하면 같은 ID로 수집하므로 로컬·Preview는 각 환경에서 새로 빌드합니다.

### 수집 확인

광고 차단을 해제한 브라우저에서 운영 홈에 직접 진입한 뒤 글 상세로 이동하고 뒤로가기를 실행합니다. Network에서 `gtag/js?id=G-VEGH5K4QQF` 스크립트가 한 번 로드되고 `g/collect` 요청이 전송되는지 확인합니다. GA4 **실시간 보고서**에서 방문을 확인하고, 디버그 모드를 켠 브라우저에서는 **DebugView**로 각 이동의 `page_view`가 한 번씩 발생하며 `page_location`·`page_referrer`가 올바른지 확인합니다. 기본 스크롤과 외부 링크 클릭도 함께 확인합니다.

로컬 개발과 Vercel Preview에서는 GA 스크립트와 수집 요청이 없어야 합니다. 실제 수신과 중복 집계 확인은 운영 환경변수 등록 및 새 배포 후 진행합니다.

## 공식 자료

- [Next.js Google Analytics 연동](https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics)
- [GA4 단일 페이지 앱 측정](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)
- [GA4 향상된 측정](https://support.google.com/analytics/answer/9216061?hl=ko)
- [Notion 내부 연결](https://developers.notion.com/guides/get-started/internal-connections)
- [공개 글 조회](https://developers.notion.com/reference/query-a-data-source)
- [Markdown 본문 조회](https://developers.notion.com/reference/retrieve-page-markdown)
- [파일 URL 만료](https://developers.notion.com/reference/file-object)
