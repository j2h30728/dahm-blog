import type { ComponentType } from "react";

export type PostModule = { default: ComponentType };

export const postModules: Record<string, () => Promise<PostModule>> = {
  "axios-cancel": () => import("./posts/axios-cancel.mdx"),
  "esmodule-singleton": () => import("./posts/esmodule-singleton.mdx"),
  "rsc-dot-notation": () => import("./posts/rsc-dot-notation.mdx"),
};

export const postModuleSlugs = ["axios-cancel","esmodule-singleton","rsc-dot-notation"] as const;
