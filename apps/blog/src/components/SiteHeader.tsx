"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const openSearch = () => {
    const params = new URLSearchParams(window.location.search);
    setSearchValue(pathname.startsWith("/posts") ? (params.get("q") ?? "") : "");
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
  };

  const submitSearch = () => {
    const query = searchValue.trim();
    window.location.href = query.length > 0 ? `/posts/?q=${encodeURIComponent(query)}` : "/posts/";
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

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
        </div>
        <div className={ui.navActions}>
          <form
            action="/posts/"
            aria-hidden={!searchOpen}
            className={`${ui.navSearchForm} ${searchOpen ? ui.navSearchFormOpen : ui.navSearchFormClosed}`.trim()}
            method="get"
            onSubmit={handleSearchSubmit}
          >
            <label className={ui.searchLabel} htmlFor="site-search">
              Search posts
            </label>
            <input
              className={ui.navSearchField}
              id="site-search"
              name="q"
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSearch();
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitSearch();
                }
              }}
              placeholder="Search posts"
              ref={searchInputRef}
              tabIndex={searchOpen ? 0 : -1}
              type="search"
              value={searchValue}
            />
          </form>

          <button
            aria-controls="site-search"
            aria-expanded={searchOpen}
            aria-label={searchOpen ? "Close search" : "Search posts"}
            className={ui.navIconButton}
            onClick={searchOpen ? closeSearch : openSearch}
            title={searchOpen ? "Close search" : "Search posts"}
            type="button"
          >
            {searchOpen ? (
              <svg
                aria-hidden="true"
                fill="none"
                height="17"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="17"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                fill="none"
                height="17"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="17"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            )}
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
