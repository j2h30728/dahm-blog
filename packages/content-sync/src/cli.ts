import { findWorkspaceRoot, parseCliArgs } from "./cli-options.js";
import { notionConfig, fetchNotionContent } from "./notion-sync.js";
import { loadWorkspaceEnv } from "./runtime-env.js";
import { publishPosts } from "./publish.js";
import { createImageProcessor } from "./image-processor.js";

let cleanup: (() => void) | undefined;
try {
  const root = findWorkspaceRoot();
  loadWorkspaceEnv(root);
  const options = parseCliArgs(process.argv.slice(2));
  const content = await fetchNotionContent(root, notionConfig(process.env), fetch, (workRoot) => {
    const processor = createImageProcessor({ root, workRoot, env: process.env });
    if (!processor) return undefined;
    let preparedImages = 0;
    return {
      manifest: processor.manifest,
      process: async (source: string) => {
        const image = await processor.process(source);
        preparedImages++;
        if (preparedImages % 25 === 0) console.log(`이미지 참조 ${preparedImages}개를 준비했습니다.`);
        return image;
      },
    };
  });
  cleanup = content.cleanup;
  const posts = publishPosts(content.posts, content.assetDir, options, content.imageManifest);
  console.log(`Notion 공개 글 ${posts.length}개를 동기화했습니다.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Notion 동기화 실패");
  process.exitCode = 1;
} finally {
  cleanup?.();
}
