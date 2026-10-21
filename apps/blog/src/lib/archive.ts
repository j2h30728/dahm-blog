export type PostCategory = "tech" | "life";
export type ArchiveScope = PostCategory | "all";
export type ArchivePath = "/" | "/tech/" | "/life/" | "/posts/";
export type NavigationSection = PostCategory | "about" | null;

interface ArchivePost {
  category?: PostCategory;
  title: string;
  description: string;
  excerpt: string;
  topic: string;
  tags: string[];
  series?: string;
}

export const postCategories = [
  { value: "tech", label: "기술" },
  { value: "life", label: "일상" },
] as const;

export function getArchiveCategory(value: unknown): PostCategory {
  return value === "life" ? "life" : "tech";
}

export function filterArchivePosts<T extends ArchivePost>(posts: T[], category: ArchiveScope, query = ""): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  return posts.filter((post) => {
    if (category !== "all" && getArchiveCategory(post.category) !== category) return false;
    if (!normalizedQuery) return true;

    return [post.title, post.description, post.excerpt, post.topic, post.series, ...post.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function getArchivePath(category: ArchiveScope): ArchivePath {
  if (category === "tech") return "/tech/";
  if (category === "life") return "/life/";
  return "/";
}

export function getNavigationSection(
  pathname: string,
  postCategories: Record<string, PostCategory | undefined>,
  category?: unknown,
): NavigationSection {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/tech") return "tech";
  if (path === "/life") return "life";
  if (path === "/about") return "about";
  if (path === "/posts") return getArchiveCategory(category);
  const slug = /^\/posts\/([^/]+)$/.exec(path)?.[1];
  if (slug && Object.hasOwn(postCategories, slug)) return getArchiveCategory(postCategories[slug]);
  return null;
}

export function getArchiveHref(
  search: string,
  updates: { category?: PostCategory; q?: string },
  pathname: ArchivePath = "/posts/",
): string {
  const params = new URLSearchParams(search);
  if (updates.category !== undefined) {
    if (updates.category === "tech") params.delete("category");
    else params.set("category", updates.category);
  }
  if (pathname !== "/posts/") params.delete("category");
  if (updates.q !== undefined) {
    const query = updates.q.trim();
    if (query) params.set("q", query);
    else params.delete("q");
  }
  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}`;
}
