import type { Metadata } from "next";
import { PostsSection } from "../components/PostsSection";
import { getPublishedPosts } from "../lib/posts";
import { absoluteUrl, canonicalPath, siteConfig } from "../lib/site";

export const metadata: Metadata = {
  title: "Posts",
  description: siteConfig.description,
  alternates: {
    canonical: canonicalPath(siteConfig.canonicalHomePath),
  },
  openGraph: {
    type: "website",
    url: absoluteUrl(siteConfig.canonicalHomePath),
    title: `${siteConfig.name} Posts`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} Posts`,
    description: siteConfig.description,
  },
};

export default function HomePage() {
  const posts = getPublishedPosts();
  return <PostsSection posts={posts} />;
}
