import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "../components/ThemeToggle";
import { ui } from "../lib/ui-classes";

const siteDescription = "담의 글과 기록을 모아둔 공간입니다.";

export const metadata: Metadata = {
  title: {
    default: "Dahm",
    template: "%s | Dahm",
  },
  description: siteDescription,
  alternates: {
    types: {
      "application/rss+xml": "/rss.xml",
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
        <header className={ui.siteHeader}>
          <nav aria-label="Primary" className={ui.nav}>
            <Link className={ui.brand} href="/">
              <span aria-hidden="true" className={ui.brandMark} />
              Dahm
            </Link>
            <div className={ui.navLinks}>
              <Link className={ui.navLink} href="/about/">
                About
              </Link>
              <Link className={ui.navLink} href="/posts/">
                Posts
              </Link>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className={ui.shell}>{children}</main>
        <footer className={ui.siteFooter}>
          <div className={ui.footerInner}>
            <span className={ui.footerBrand}>DAHN</span>
            <nav aria-label="Footer" className={ui.footerLinks}>
              <Link className={ui.footerLink} href="/rss.xml">
                RSS
              </Link>
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
