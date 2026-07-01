import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts, getTagEntries } from "../../lib/posts";
import { ui } from "../../lib/ui-classes";

export const metadata: Metadata = {
  title: "Tags",
};

export default function TagsPage() {
  const tags = getTagEntries(getPublishedPosts());

  return (
    <section aria-labelledby="tags-title" className={ui.pageSection}>
      <div className={ui.sectionHeading}>
        <div>
          <p className={ui.tagline}>Tags</p>
          <h1 className={ui.sectionTitle} id="tags-title">
            Tags
          </h1>
        </div>
        <p className={ui.sectionMeta}>{tags.length} tags</p>
      </div>

      <div className={ui.seriesList}>
        {tags.map((entry) => (
          <article className={ui.seriesCard} key={entry.slug}>
            <Link className={ui.seriesCardLink} href={`/tags/${entry.slug}/`}>
              <div className={ui.seriesBody}>
                <div className={ui.seriesTopline}>
                  <span>{entry.count} posts</span>
                </div>
                <h2 className={ui.seriesTitle}>{entry.name}</h2>
                <div className={ui.seriesPreviewList}>
                  {entry.posts.slice(0, 3).map((post) => (
                    <span className={ui.seriesPreviewItem} key={post.slug}>
                      {post.title}
                    </span>
                  ))}
                </div>
              </div>
              <span className={ui.seriesAction}>Open</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
