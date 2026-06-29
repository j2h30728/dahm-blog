import Link from "next/link";
import type { RelatedPostScore } from "../lib/related-posts";
import { ui } from "../lib/ui-classes";

interface RelatedPostsProps {
  related: RelatedPostScore[];
}

export function RelatedPosts({ related }: RelatedPostsProps) {
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related-title" className={ui.relatedSection}>
      <h2 className={ui.relatedTitle} id="related-title">
        Related posts
      </h2>
      <div className={ui.relatedGrid}>
        {related.map(({ post, reasons }) => (
          <Link className={ui.relatedCard} href={post.href} key={post.slug}>
            <span className={ui.relatedKicker}>{post.series}</span>
            <strong className={ui.postTitle}>{post.title}</strong>
            <small className={ui.relatedMeta}>{reasons.join(", ")}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
