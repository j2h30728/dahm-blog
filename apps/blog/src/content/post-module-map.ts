import type { ComponentType } from "react";

export type PostModule = { default: ComponentType };

export const postModules: Record<string, () => Promise<PostModule>> = {
  "10weeks-ta": () => import("./posts/10weeks-ta.mdx"),
  "2025": () => import("./posts/2025.mdx"),
  "2025teoconf": () => import("./posts/2025teoconf.mdx"),
  "axios-cancel": () => import("./posts/axios-cancel.mdx"),
  "esmodule-singleton": () => import("./posts/esmodule-singleton.mdx"),
  "firstdeveloper": () => import("./posts/firstdeveloper.mdx"),
  "hanghae-6": () => import("./posts/hanghae-6.mdx"),
  "openapi-codegen": () => import("./posts/openapi-codegen.mdx"),
  "rsc-dot-notation": () => import("./posts/rsc-dot-notation.mdx"),
  "seconddev": () => import("./posts/seconddev.mdx"),
  "seconddeveloper": () => import("./posts/seconddeveloper.mdx"),
};

export const postModuleSlugs = ["10weeks-ta","2025","2025teoconf","axios-cancel","esmodule-singleton","firstdeveloper","hanghae-6","openapi-codegen","rsc-dot-notation","seconddev","seconddeveloper"] as const;
