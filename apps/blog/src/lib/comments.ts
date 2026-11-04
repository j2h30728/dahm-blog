export interface GiscusConfig {
  repo: `${string}/${string}`;
  repoId: string;
  category: string;
  categoryId: string;
}

export function getGiscusConfig(env: NodeJS.ProcessEnv = process.env): GiscusConfig | null {
  if (env.GISCUS_ENABLED?.trim().toLowerCase() === "false") return null;

  return {
    repo: "j2h30728/dahm-blog",
    repoId: "R_kgDOTChpKA",
    category: "Announcements",
    categoryId: "DIC_kwDOTChpKM4DKVhX",
  };
}
