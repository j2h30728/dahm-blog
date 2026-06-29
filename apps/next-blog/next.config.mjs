import createMDX from "@next/mdx";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkFrontmatter, remarkGfm],
    rehypePlugins: [
      [
        rehypeShiki,
        {
          themes: {
            light: "github-dark",
            dark: "github-dark",
          },
        },
      ],
      rehypeSlug,
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default withMDX(nextConfig);
