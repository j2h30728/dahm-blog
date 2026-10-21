import type { Post } from "../lib/posts";
import { PostArchive } from "./PostArchive";

interface PostsSectionProps {
  posts: Post[];
}

export function PostsSection({ posts }: PostsSectionProps) {
  return <PostArchive posts={posts} />;
}
