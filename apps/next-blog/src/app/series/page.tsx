import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPosts, getSeriesEntries } from "../../lib/posts";
import { ui } from "../../lib/ui-classes";

export const metadata: Metadata = {
  title: "Series",
};

export default function SeriesPage() {
  const series = getSeriesEntries(getPublishedPosts());

  return (
    <>
      <h1 className={ui.pageTitle}>Series</h1>
      <div className={ui.postList}>
        {series.map((entry) => (
          <article className={ui.postCard} key={entry.slug}>
            <Link className={ui.postCardLink} href={`/series/${entry.slug}/`}>
              <h2 className={ui.postTitle}>{entry.name}</h2>
              <p className={ui.postDescription}>{entry.posts.length} posts</p>
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
