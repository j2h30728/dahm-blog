import { PostsSection } from "../components/PostsSection";
import { getPublishedPosts } from "../lib/posts";

export default function HomePage() {
  const posts = getPublishedPosts();
  return <PostsSection posts={posts} />;
}
