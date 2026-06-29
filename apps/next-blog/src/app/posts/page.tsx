import type { Metadata } from "next";
import { PostsSection } from "../../components/PostsSection";
import { getPublishedPosts } from "../../lib/posts";

export const metadata: Metadata = {
  title: "Posts",
  description: "담의 글 목록입니다.",
};

export default function PostsPage() {
  const posts = getPublishedPosts();
  return <PostsSection posts={posts} />;
}
