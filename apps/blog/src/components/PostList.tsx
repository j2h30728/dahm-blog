import Link from "next/link";
import { formatPostDate, type Post } from "../lib/posts";
import { ui } from "../lib/ui-classes";
import { getArchiveCategory } from "../lib/archive";

interface PostListProps {
  posts: Post[];
  showCategory?: boolean;
}

export function PostList({ posts, showCategory = false }: PostListProps) {
  return (
    <div className={ui.postList}>
      {posts.map((post) => (
        <article className={ui.postCard} key={post.slug}>
          <Link className={ui.postCardLink} href={post.href}>
            <h2 className={ui.postTitle}>{post.title}</h2>
            <p className={ui.postDescription}>{post.description}</p>
            <div className={ui.postMeta}>
              <time className={ui.postDate} dateTime={new Date(post.date).toISOString()}>
                {formatPostDate(post.date)}
              </time>
              {showCategory ? (
                <span className={ui.postCategory}>
                  <span aria-hidden="true">· </span>
                  {getArchiveCategory(post.category) === "life" ? "일상" : "기술"}
                </span>
              ) : null}
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
