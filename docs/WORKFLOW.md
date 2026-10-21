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

글 목록의 기본 기술 분류 URL은 `/posts/`, 일상 분류 URL은 `/posts/?category=life`입니다. 검색은 선택한 분류 안에서만 동작하며 분류를 이동해도 검색어를 유지합니다.

태그 URL은 동기화가 생성한 `tagSlugs`, 시리즈 URL은 `seriesSlug`를 앱이 그대로 사용합니다. Unicode 문자를 보존하며 `C++`와 `C#`처럼 서로 다른 이름이 같은 URL로 정규화되거나 이름이 빈 URL을 만들면 출력 전에 오류로 중단합니다.

## 본문과 미디어

CJK 문장과 문장부호가 붙어 문자로 남은 `**강조(설명)**에서는` 형태는 원문과 AST text가 일치할 때만 강조로 보완합니다. escape된 기호와 코드·링크 주소는 재해석하지 않습니다.

- 제목, 단락, 목록, 인용, 링크, 코드, 이미지와 일반 표를 변환합니다.
- 본문 이미지는 클릭·키보드로 확대합니다. ESC·바깥 영역·닫기 버튼으로 닫으며, 모바일 화면 안에 원래 비율로 표시합니다. 닫으면 원래 이미지로 포커스와 배경 스크롤 상태를 복원합니다. 이미지 링크도 확대를 지원하고 보조키 클릭은 원래 링크 동작을 유지합니다.
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

Vercel의 빌드 명령 `pnpm build:blog`가 최신 공개 글을 가져옵니다. Notion 변경으로 배포를 자동 시작하는 웹훅은 아직 없습니다. 운영 반영은 Vercel 재배포 또는 새 Git 배포로 진행합니다.

API·출력 검사 중에는 `--out`, `--assets`, `--manifest`, `--public-index`, `--public-post-index`, `--search-index`, `--post-module-map`으로 생성 경로만 바꿀 수 있습니다. 로컬 파일 게시 모드·vault·preview 입력은 지원하지 않습니다.

## 공식 자료

- [Notion 내부 연결](https://developers.notion.com/guides/get-started/internal-connections)
- [공개 글 조회](https://developers.notion.com/reference/query-a-data-source)
- [Markdown 본문 조회](https://developers.notion.com/reference/retrieve-page-markdown)
- [파일 URL 만료](https://developers.notion.com/reference/file-object)
