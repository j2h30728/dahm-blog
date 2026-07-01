import type { ComponentType } from "react";

export type PostModule = {
  default: ComponentType;
};

export const postModules: Record<string, () => Promise<PostModule>> = {
  "content-boundaries": () => import("./posts/content-boundaries.mdx"),
  "hello-pipeline": () => import("./posts/hello-pipeline.mdx"),
  "obsidian-feature-showcase": () => import("./posts/obsidian-feature-showcase.mdx"),
  "openapi-generator-boundaries": () => import("./posts/openapi-generator-boundaries.mdx"),
  "rsc-dot-notation-reexport": () => import("./posts/rsc-dot-notation-reexport.mdx"),
};

export const postModuleSlugs = ["content-boundaries","hello-pipeline","obsidian-feature-showcase","openapi-generator-boundaries","rsc-dot-notation-reexport"] as const;
