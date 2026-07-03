import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "../components/SiteHeader";
import { absoluteUrl, getSiteUrl, siteConfig } from "../lib/site";
import { ui } from "../lib/ui-classes";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  authors: [{ name: siteConfig.author, url: siteConfig.authorUrl }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  alternates: {
    canonical: siteConfig.canonicalHomePath,
    types: {
      "application/rss+xml": absoluteUrl("/rss.xml"),
    },
  },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: absoluteUrl(siteConfig.canonicalHomePath),
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
      </head>
      <body>
        <SiteHeader />
        <main className={ui.shell}>{children}</main>
        <footer className={ui.siteFooter}>
          <div className={ui.footerInner}>
            <div>
              <span className={ui.footerBrand}>Dahm</span>
              <p className={ui.footerMeta}>글과 선택의 기록.</p>
            </div>
            <nav aria-label="Footer" className={ui.footerLinks}>
              <Link className={ui.footerLink} href="/rss.xml">
                RSS
              </Link>
              <a className={ui.footerLink} href="https://github.com/j2h30728">
                GitHub
              </a>
              <a className={ui.footerLink} href="mailto:rachel2148072@gmail.com">
                Email
              </a>
            </nav>
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: typewriterScript }} />
      </body>
    </html>
  );
}

const initialThemeScript = `
const _s = localStorage.getItem('theme');
document.documentElement.dataset.theme =
  _s === 'dark' || _s === 'light' ? _s
  : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
`;

const typewriterScript = `
(() => {
  const el = document.querySelector('.typewriter');
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('done');
    return;
  }
  const text = el.textContent.trim();
  el.textContent = '';
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(type, 58);
    } else {
      el.classList.add('done');
    }
  }
  setTimeout(type, 350);
})();
`;
