import type { Metadata } from "next";
import { PostsSection } from "../components/PostsSection";
import { getPublishedPosts } from "../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../lib/site";

export const metadata: Metadata = {
  title: { absolute: siteConfig.homeTitle },
  description: null,
  alternates: {
    canonical: canonicalPath(siteConfig.canonicalHomePath),
  },
  openGraph: {
    images: [],
    type: "website",
    url: absoluteUrl(siteConfig.canonicalHomePath),
    title: siteConfig.homeTitle,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    images: [],
    title: siteConfig.homeTitle,
  },
};

export default function HomePage() {
  const posts = getPublishedPosts();
  return <PostsSection posts={posts} category="all" />;
}
