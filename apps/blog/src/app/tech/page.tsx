import type { Metadata } from "next";
import { PostsSection } from "../../components/PostsSection";
import { getPublishedPosts } from "../../lib/posts";
import { absoluteUrl, siteConfig } from "../../lib/site";

const description = "개발하며 배운 것과 문제를 해결한 기록.";

export const metadata: Metadata = {
  title: "기술",
  description,
  alternates: { canonical: "/tech/" },
  openGraph: {
    type: "website",
    url: absoluteUrl("/tech/"),
    title: `${siteConfig.name} 기술`,
    description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: { card: "summary", title: `${siteConfig.name} 기술`, description },
};

export default function TechPage() {
  return <PostsSection posts={getPublishedPosts()} category="tech" />;
}
