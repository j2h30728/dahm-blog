import { findWorkspaceRoot, parseCliArgs } from "./cli-options.js";
import { notionConfig, fetchNotionContent } from "./notion-sync.js";
import { loadWorkspaceEnv } from "./runtime-env.js";
import { publishPosts } from "./publish.js";

let cleanup: (() => void) | undefined;
try {
  const root = findWorkspaceRoot();
  loadWorkspaceEnv(root);
  const options = parseCliArgs(process.argv.slice(2));
  const content = await fetchNotionContent(root, notionConfig(process.env));
  cleanup = content.cleanup;
  const posts = publishPosts(content.posts, content.assetDir, options);
  console.log(`Notion 공개 글 ${posts.length}개를 동기화했습니다.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Notion 동기화 실패");
  process.exitCode = 1;
} finally {
  cleanup?.();
}
