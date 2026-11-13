# Dahm blog

Obsidian에서 작성한 공개 글·메모를 보여주는 Astro 정적 블로그입니다.

```bash
pnpm install
# .env.local에 OBSIDIAN_BLOG_DIR=/absolute/path/to/Obsidian/blog 설정
pnpm dev
```

원본의 `posts/`, `notes/`에서 YAML `publish: true`인 Markdown과 실제 참조 첨부만 가져옵니다. 개발 중에는 원본 변경을 감시합니다. 원본을 수정하거나 Notion API에 접근하지 않습니다.

- `pnpm sync:content`: 공개 사본 갱신
- `pnpm build`: 동기화 또는 배포용 공개 사본 검증 후 정적 빌드
- `pnpm typecheck`: Astro·TypeScript 검사
- `pnpm test`: 콘텐츠 변환 및 사이트 산출물 검사. 사이트 검사는 `pnpm build` 후 실행합니다.
- `pnpm test:browser`: 빌드된 사이트의 실제 브라우저 동작 검사
- `pnpm test:integration`: 별도 테스트 사이트에서 공개 메모·비공개 제거·개발 중 자동 갱신 검사

개인 원본 경로는 `.env.local`에만 설정합니다. 배포에는 저장소 안의 공개 사본을 사용하며, 출력은 `apps/blog/dist`입니다.


작성 속성, 이미지 크기, 공개·비공개 전환과 배포 과정은 [운영 문서](docs/WORKFLOW.md)를 참고하세요.
