import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPosts, getSeriesEntries } from "../../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../../lib/site";
import { ui } from "../../lib/ui-classes";

const description = "담의 글을 시리즈별로 묶어 탐색하는 페이지입니다.";

export const indexMetadata: Metadata = {
  title: "Series",
  description,
  alternates: {
    canonical: canonicalPath("/series/"),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/series/"),
    title: `${siteConfig.name} Series`,
    description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} Series`,
    description,
  },
};

export default function SeriesPage() {
  const series = getSeriesEntries(getPublishedPosts());

  return (
    <section aria-labelledby="series-title" className={ui.pageSection}>
      <div className={ui.sectionHeading}>
        <div>
          <p className={ui.tagline}>Series</p>
          <h1 className={ui.sectionTitle} id="series-title">
            Series
          </h1>
        </div>
        <p className={ui.sectionMeta}>{series.length} series</p>
      </div>

      <div className={ui.seriesList}>
        {series.map((entry) => (
          <article className={ui.seriesCard} key={entry.slug}>
            <Link className={ui.seriesCardLink} href={`/series/${entry.slug}/`}>
              <div className={ui.seriesBody}>
                <div className={ui.seriesTopline}>
                  <span>{entry.posts.length} posts</span>
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
