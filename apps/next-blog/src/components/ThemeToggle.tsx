"use client";

import { useEffect, useState } from "react";
import { ui } from "../lib/ui-classes";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getEffectiveTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const nextLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      aria-label={nextLabel}
      className={ui.themeToggle}
      data-current={theme}
      id="theme-toggle"
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      type="button"
    >
      <span className={ui.themeToggleLightIcon} data-show="light">
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" x2="12" y1="2" y2="5" />
          <line x1="12" x2="12" y1="19" y2="22" />
          <line x1="2" x2="5" y1="12" y2="12" />
          <line x1="19" x2="22" y1="12" y2="12" />
          <line x1="4.22" x2="6.34" y1="4.22" y2="6.34" />
          <line x1="17.66" x2="19.78" y1="17.66" y2="19.78" />
          <line x1="4.22" x2="6.34" y1="19.78" y2="17.66" />
          <line x1="17.66" x2="19.78" y1="6.34" y2="4.22" />
        </svg>
      </span>
      <span className={ui.themeToggleDarkIcon} data-show="dark">
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </button>
  );
}

function getEffectiveTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
