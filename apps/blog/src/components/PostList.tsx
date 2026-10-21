import Link from "next/link";
import { formatPostDate, type Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";

interface PostListProps {
  posts: Post[];
}

export function PostList({ posts }: PostListProps) {
  return (
    <div className={ui.postList}>
      {posts.map((post) => (
        <article className={ui.postCard} key={post.slug}>
          <Link className={ui.postCardLink} href={post.href}>
            <h2 className={ui.postTitle}>{post.title}</h2>
            <p className={ui.postDescription}>{post.description}</p>
            <time className={ui.postDate} dateTime={new Date(post.date).toISOString()}>
              {formatPostDate(post.date)}
            </time>
          </Link>
        </article>
      ))}
    </div>
  );
}
