import type { Post } from "../lib/posts";
import { getSeriesEntries, getTagEntries } from "../lib/posts";
import { PostArchive } from "./PostArchive";

interface PostsSectionProps {
  posts: Post[];
}

export function PostsSection({ posts }: PostsSectionProps) {
  const series = getSeriesEntries(posts).map((entry) => ({
    count: entry.posts.length,
    name: entry.name,
    slug: entry.slug,
  }));
  const tags = getTagEntries(posts);

  return <PostArchive posts={posts} series={series} tags={tags} />;
}
