import type { Metadata } from "next";
import { PostsSection } from "../components/PostsSection";
import { getPublishedPosts } from "../lib/posts";
import { absoluteUrl, getSocialImage, canonicalPath, siteConfig } from "../lib/site";

export const metadata: Metadata = {
  title: { absolute: siteConfig.homeTitle },
  description: siteConfig.description,
  alternates: {
    canonical: canonicalPath(siteConfig.canonicalHomePath),
  },
  openGraph: {
    images: [getSocialImage()],
    type: "website",
    url: absoluteUrl(siteConfig.canonicalHomePath),
    title: siteConfig.homeTitle,
    description: siteConfig.description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary_large_image",
    images: [getSocialImage()],
    title: siteConfig.homeTitle,
    description: siteConfig.description,
  },
};

export default function HomePage() {
  const posts = getPublishedPosts();
  return <PostsSection posts={posts} category="all" />;
}
