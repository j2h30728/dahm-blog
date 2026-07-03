import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "../../../components/PostList";
import { getPublishedPosts, getSeriesEntries, getSeriesEntryBySlug } from "../../../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../../../lib/site";
import { ui } from "../../../lib/ui-classes";

interface PageProps {
  params: Promise<{
    series: string;
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getSeriesEntries(getPublishedPosts()).map((entry) => ({ series: entry.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { series } = await params;
  const entry = getSeriesEntryBySlug(series);
  if (!entry) return {};

  const title = `Series: ${entry.name}`;
  const description = `${entry.name} 시리즈의 글 ${entry.posts.length}개를 모아둔 페이지입니다.`;
  const url = `/series/${series}/`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath(url),
    },
    openGraph: {
      type: "website",
      url: absoluteUrl(url),
      title,
      description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { series } = await params;
  const entry = getSeriesEntryBySlug(series);
  if (!entry) notFound();

  return (
    <>
      <h1 className={ui.pageTitle}>{entry.name}</h1>
      <PostList posts={entry.posts} />
    </>
  );
}
