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

      <div aria-label="Tags" className={ui.tagList}>
        {tags.map((entry) => (
          <Link className={ui.tagPill} href={`/tags/${entry.slug}/`} key={entry.slug}>
            {entry.name}
            <span className={ui.tagCount}>{entry.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
