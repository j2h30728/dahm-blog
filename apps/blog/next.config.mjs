import createMDX from "@next/mdx";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkNotionTypography from "./src/lib/remark-notion-typography.mjs";

// sync CLI와 Next 빌드는 서로 다른 프로세스이므로 루트 환경파일을 각각 읽는다.
for (const name of ["../../.env.local", "../../.env"]) {
  const file = fileURLToPath(new URL(name, import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}

export const mdxOptions = {
  remarkPlugins: [remarkGfm, remarkNotionTypography],
  rehypePlugins: [
    [
      rehypeShiki,
      {
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
      },
    ],
    rehypeSlug,
  ],
};

const withMDX = createMDX({ options: mdxOptions });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default function config(phase) {
  // dev의 export 경로 검사는 존재하지 않는 선택 경로를 500으로 만들 수 있다.
  // 운영 빌드는 정적 내보내기를 유지하고 dev는 일반적인 notFound 처리를 사용한다.
  return withMDX({ ...nextConfig, output: phase === PHASE_DEVELOPMENT_SERVER ? undefined : "export" });
}
