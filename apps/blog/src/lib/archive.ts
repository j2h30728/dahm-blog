export type PostCategory = "tech" | "life";

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

export function filterArchivePosts<T extends ArchivePost>(posts: T[], category: PostCategory, query = ""): T[] {
  const normalizedQuery = query.trim().toLowerCase();

  return posts.filter((post) => {
    if (getArchiveCategory(post.category) !== category) return false;
    if (!normalizedQuery) return true;

    return [post.title, post.description, post.excerpt, post.topic, post.series, ...post.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function getArchiveHref(search: string, updates: { category?: PostCategory; q?: string }): string {
  const params = new URLSearchParams(search);
  if (updates.category !== undefined) {
    if (updates.category === "tech") params.delete("category");
    else params.set("category", updates.category);
  }
  if (updates.q !== undefined) {
    const query = updates.q.trim();
    if (query) params.set("q", query);
    else params.delete("q");
  }
  const queryString = params.toString();
  return `/posts/${queryString ? `?${queryString}` : ""}`;
}
