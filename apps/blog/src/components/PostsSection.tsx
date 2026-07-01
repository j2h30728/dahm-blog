import type { Post } from "../lib/posts";
import { getTopicEntries } from "../lib/posts";
import { PostArchive } from "./PostArchive";

interface PostsSectionProps {
  posts: Post[];
}

export function PostsSection({ posts }: PostsSectionProps) {
  const topics = getTopicEntries(posts);

  return <PostArchive posts={posts} topics={topics} />;
}
