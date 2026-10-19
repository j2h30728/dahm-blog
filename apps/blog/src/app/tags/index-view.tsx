import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts, getTagEntries } from "../../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../../lib/site";
import { ui } from "../../lib/ui-classes";

const description = "담의 글을 태그별로 탐색하는 페이지입니다.";

export const indexMetadata: Metadata = {
  title: "Tags",
  description,
  alternates: {
    canonical: canonicalPath("/tags/"),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/tags/"),
    title: `${siteConfig.name} Tags`,
    description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} Tags`,
    description,
  },
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
