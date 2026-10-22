# 이미지 확대 브라우저 회귀 검사

`image-lightbox.js`는 Playwright MCP의 `browser_run_code_unsafe`에 `filename`으로 전달하는 검사 함수다. 정적 미리보기 주소는 `http://127.0.0.1:3037`이며, 스크린샷 경로는 함수 상단의 작업 디렉터리에 맞춘다. 실제 글 이미지와 키보드·모바일 터치·오류·이미지 링크를 검사한다. 반환값의 `errors`가 비어 있어야 통과다.

1. 앱의 production build를 완료하고 `apps/blog/out`을 3037 포트에서 제공한다.
2. 저장소 루트에서 기존 `tsx`의 `esbuild`로 브라우저 전용 fixture를 준비한다. 새 의존성을 설치하지 않는다.

```bash
rtk proxy node -e 'const {createRequire}=require("node:module"); const p=createRequire(process.cwd()+"/packages/content-sync/package.json"); const r=createRequire(p.resolve("tsx")); r("esbuild").buildSync({entryPoints:["apps/blog/test/browser/image-lightbox-fixture.tsx"],bundle:true,platform:"browser",format:"iife",jsx:"automatic",outfile:"apps/blog/out/__image-lightbox-qa__/fixture.js",define:{"process.env.NODE_ENV":"\"development\""}})'
```

3. MCP에서 `image-lightbox.js`를 실행한다. fixture HTML과 오류 이미지는 해당 테스트 페이지의 요청 가로채기로만 제공된다. 클릭 전 원본 요청 0건, 클릭 후 1건과 원본 실패 시 미리보기 유지를 함께 검사한다. 실제 게시글을 추가하지 않는다.
4. 검사 후 생성한 `apps/blog/out/__image-lightbox-qa__/fixture.js`와 빈 디렉터리를 삭제한다. 이 임시 fixture를 배포하지 않는다.

`pnpm --filter @dahm-blog/blog test`는 별도로 실제 MDX 컴파일·SSR 구조·원본 속성·사용자 컴포넌트 우선순위를 확인한다.

`image-caption-width.js`도 같은 최신 build·fixture bundle을 준비한 뒤 실행한다. 캡션 끝 `{width=360}`의 360px 표시와 모바일 축소, 너비 생략, 긴 캡션의 자동 크기 보존, 크기 표기 숨김, 이미지 링크·확대 닫기를 검사한다. 실제 노션 페이지를 수정하지 않는다.

# 상단 메뉴와 전체 홈 회귀 검사

`top-navigation.js` 역시 Playwright MCP의 `browser_run_code_unsafe`에 `filename`으로 전달한다. production export를 3037 포트에서 제공하면 별도 fixture 준비 없이 실행할 수 있다. 홈·기술·일상·소개 이동, 전체/분류 검색, 검색 초기화·해제, 상세 메뉴, 기존 주소, canonical·사이트맵, 모바일 헤더와 키보드를 검사한다. 현재 공개 글은 모두 기술이므로 일상 글이 섞인 전체 목록은 `archive.test.mjs`의 혼합 fixture로 확인한다. 브라우저 함수 반환값의 `errors`가 비어 있어야 통과다.

로고 회귀 검사는 검색 결과에서 직접 복귀, 검색→상세→로고, 기술·일상·기존 주소의 검색, 입력 초안, Enter·보조키·모바일 터치에서 검색어 없는 전체 홈이 복원되는지 확인한다. 같은 document/body/timeOrigin과 테마·프레임별 배경색 유지, document 요청 0건, 뒤로/앞으로가기와 이동 취소도 검사해 새로고침과 흰 배경 전환의 재발을 막는다.
