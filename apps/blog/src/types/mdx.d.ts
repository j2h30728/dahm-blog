declare module "*.mdx" {
  const MDXContent: import("react").ComponentType;
  export const tableOfContents: Array<{ depth: number; id: string; text: string }>;
  export default MDXContent;
}
