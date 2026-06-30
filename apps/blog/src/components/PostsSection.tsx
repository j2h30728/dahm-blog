import type { Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";
import { PostList } from "./PostList";

interface PostsSectionProps {
  posts: Post[];
}

export function PostsSection({ posts }: PostsSectionProps) {
  return (
    <section aria-labelledby="posts-title" className={ui.pageSection} id="posts">
      <div className={ui.sectionHeading}>
        <div>
          <p className={ui.tagline}>Posts</p>
          <h1 className={ui.sectionTitle} id="posts-title">
            Posts
          </h1>
        </div>
        <p className={ui.sectionMeta}>{posts.length} posts</p>
      </div>
      <PostList posts={posts} />
    </section>
  );
}
