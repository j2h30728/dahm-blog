import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "../../../components/PostList";
import { getPublishedPosts, getSeriesEntries, getSeriesEntryBySlug } from "../../../lib/posts";
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

  return {
    title: `Series: ${entry.name}`,
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
