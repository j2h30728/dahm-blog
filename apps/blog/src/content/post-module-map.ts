import type { ComponentType } from "react";

export type PostModule = {
  default: ComponentType;
};

export const postModules: Record<string, () => Promise<PostModule>> = {
  "obsidian-feature-showcase": () => import("./posts/obsidian-feature-showcase.mdx"),
  "openapi-generator-boundaries": () => import("./posts/openapi-generator-boundaries.mdx"),
  "rsc-dot-notation-reexport": () => import("./posts/rsc-dot-notation-reexport.mdx"),
};

export const postModuleSlugs = ["obsidian-feature-showcase","openapi-generator-boundaries","rsc-dot-notation-reexport"] as const;
