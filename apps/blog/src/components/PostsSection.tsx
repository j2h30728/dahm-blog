import type { Post } from "../lib/posts";
import { PostArchive } from "./PostArchive";
import type { ArchiveScope } from "../lib/archive";

interface PostsSectionProps {
  posts: Post[];
  category?: ArchiveScope;
}

export function PostsSection({ posts, category }: PostsSectionProps) {
  return <PostArchive posts={posts} category={category} />;
}
