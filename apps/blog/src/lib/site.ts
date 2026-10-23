export const siteConfig = {
  name: "Dahm",
  homeTitle: "Dahm — 프론트엔드 개발과 일상의 기록",
  socialImage: {
    url: "/og/dahm.png",
    width: 1200,
    height: 630,
    alt: "dahm-lee — 글과 선택의 기록",
  },
  description: "담의 글과 기록을 모아둔 공간입니다.",
  author: "Dahm",
  authorUrl: "https://github.com/j2h30728",
  language: "ko",
  locale: "ko_KR",
  canonicalHomePath: "/",
} as const;

const localSiteUrl = "http://localhost:3000";

export function getSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configuredUrl = env.PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return normalizeSiteUrl(configuredUrl);

  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return normalizeSiteUrl(`https://${env.VERCEL_URL}`);
  }

  if (shouldRequirePublicSiteUrl(env)) {
    throw new Error(
      "PUBLIC_SITE_URL is required for production SEO URL generation. Set PUBLIC_SITE_URL=https://your-domain.example.",
    );
  }

  if (allowsLocalSiteUrl(env)) return localSiteUrl;

  throw new Error("PUBLIC_SITE_URL is required unless local URL fallback is explicitly allowed.");
}

export function shouldRequirePublicSiteUrl(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REQUIRE_PUBLIC_SITE_URL === "true" || env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

export function absoluteUrl(path = "/", env: NodeJS.ProcessEnv = process.env): string {
  return new URL(canonicalPath(path), `${getSiteUrl(env)}/`).toString();
}

export function canonicalPath(path = "/"): string {
  if (path.includes("?") || path.includes("#")) {
    throw new Error(`Canonical paths must not include query strings or fragments: ${path}`);
  }

  const pathname = path.startsWith("/") ? path : `/${path}`;
  if (pathname === "/") return "/";
  if (isFileRoute(pathname)) return pathname;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function allowsLocalSiteUrl(env: NodeJS.ProcessEnv): boolean {
  return env.ALLOW_LOCAL_SITE_URL === "true" || (env.NODE_ENV !== "production" && !env.VERCEL_ENV);
}

function normalizeSiteUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`PUBLIC_SITE_URL must use http or https: ${value}`);
  }
  return url.origin;
}

function isFileRoute(pathname: string): boolean {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  return /\.[a-z0-9]+$/i.test(lastSegment);
}

export function getSocialImage(post?: { slug: string; title: string }) {
  return {
    ...siteConfig.socialImage,
    url: absoluteUrl(post ? getPostSocialImagePath(post.slug) : siteConfig.socialImage.url),
    alt: post ? post.title : siteConfig.socialImage.alt,
  };
}

export function getPostSocialImagePath(slug: string): string {
  if (!slug || slug === "." || slug === ".." || /[/\\\u0000-\u001f]/.test(slug)) {
    throw new Error(`Invalid social image slug: ${slug}`);
  }
  return `/og/posts/${encodeURIComponent(slug)}.png`;
}
