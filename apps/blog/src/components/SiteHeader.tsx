"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ui } from "../lib/ui-classes";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/about/", label: "About", match: (pathname: string) => pathname.startsWith("/about") },
  { href: "/posts/", label: "Posts", match: (pathname: string) => pathname === "/" || pathname.startsWith("/posts") },
  { href: "/series/", label: "Series", match: (pathname: string) => pathname.startsWith("/series") },
  { href: "/tags/", label: "Tags", match: (pathname: string) => pathname.startsWith("/tags") },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className={ui.siteHeader}>
      <nav aria-label="Primary" className={ui.nav}>
        <Link className={ui.brand} href="/">
          <span aria-hidden="true" className={ui.brandMark} />
          Dahm
        </Link>
        <div className={ui.navLinks}>
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`${ui.navLink} ${active ? ui.navLinkActive : ""}`.trim()}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
