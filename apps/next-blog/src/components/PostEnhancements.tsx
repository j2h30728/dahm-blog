"use client";

import { useEffect } from "react";

interface PreviewItem {
  title: string;
  description: string;
  excerpt: string;
  tags: string[];
  href: string;
}

interface PostEnhancementsProps {
  previews: Record<string, PreviewItem>;
}

export function PostEnhancements({ previews }: PostEnhancementsProps) {
  useEffect(() => {
    const cleanupPreview = bindInternalLinkPreviews(previews);
    const cleanupCopyButtons = bindCodeCopyButtons();
    const cleanupToc = bindTocActivation();

    return () => {
      cleanupPreview();
      cleanupCopyButtons();
      cleanupToc();
    };
  }, [previews]);

  return null;
}

function bindInternalLinkPreviews(previews: Record<string, PreviewItem>): () => void {
  const preview = document.createElement("div");
  preview.id = "internal-link-preview";
  preview.className = "internal-link-preview";
  preview.setAttribute("role", "status");
  preview.setAttribute("aria-live", "polite");
  preview.hidden = true;
  document.body.append(preview);

  const internalLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.content a[href^="/posts/"]'));
  const cleanups: Array<() => void> = [];

  for (const anchor of internalLinks) {
    anchor.classList.add("internal-link");

    const showHandler = () => showPreview(anchor, preview, previews);
    const hideHandler = () => hidePreview(anchor, preview);
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") hidePreview(anchor, preview);
    };

    anchor.addEventListener("mouseenter", showHandler);
    anchor.addEventListener("mouseleave", hideHandler);
    anchor.addEventListener("focus", showHandler);
    anchor.addEventListener("blur", hideHandler);
    anchor.addEventListener("keydown", keyHandler);

    cleanups.push(() => {
      anchor.removeEventListener("mouseenter", showHandler);
      anchor.removeEventListener("mouseleave", hideHandler);
      anchor.removeEventListener("focus", showHandler);
      anchor.removeEventListener("blur", hideHandler);
      anchor.removeEventListener("keydown", keyHandler);
      anchor.classList.remove("internal-link");
      anchor.removeAttribute("aria-describedby");
    });
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    preview.remove();
  };
}

function showPreview(anchor: HTMLAnchorElement, preview: HTMLDivElement, previews: Record<string, PreviewItem>): void {
  const slug = slugFromLink(anchor);
  const item = slug ? previews[slug] : null;
  if (!item) return;

  const summary = item.description || item.excerpt || "";
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 4) : [];
  preview.innerHTML = [
    `<strong>${escapeHtml(item.title)}</strong>`,
    summary ? `<span>${escapeHtml(summary)}</span>` : "",
    tags.length > 0
      ? `<div class="internal-link-preview-tags">${tags.map((tag) => `<small>${escapeHtml(tag)}</small>`).join("")}</div>`
      : "",
  ].join("");
  preview.hidden = false;
  anchor.setAttribute("aria-describedby", preview.id);

  const rect = anchor.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 32);
  const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
  const top = Math.min(rect.bottom + 10, window.innerHeight - preview.offsetHeight - 16);
  preview.style.width = `${width}px`;
  preview.style.left = `${left}px`;
  preview.style.top = `${Math.max(16, top)}px`;
}

function hidePreview(anchor: HTMLAnchorElement, preview: HTMLDivElement): void {
  preview.hidden = true;
  anchor.removeAttribute("aria-describedby");
}

function slugFromLink(anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute("href");
  if (!href) return null;
  const url = new URL(href, window.location.origin);
  const match = /^\/posts\/([^/]+)\/?/.exec(url.pathname);
  return match?.[1] ?? null;
}

function bindCodeCopyButtons(): () => void {
  const codeBlocks = Array.from(document.querySelectorAll<HTMLPreElement>(".content pre"));
  const frames: HTMLElement[] = [];

  for (const pre of codeBlocks) {
    if (pre.closest(".code-block-frame")) continue;

    const code = pre.querySelector("code");
    if (!code) continue;

    const frame = document.createElement("div");
    frame.className = "code-block-frame";
    pre.parentNode?.insertBefore(frame, pre);
    frame.append(pre);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-button";
    button.dataset.state = "idle";
    button.setAttribute("aria-label", "코드 복사");
    button.title = "코드 복사";
    frame.append(button);

    button.addEventListener("click", async () => {
      try {
        await copyText(code.textContent ?? "");
        setButtonState(button, "copied");
      } catch {
        setButtonState(button, "failed");
      }
    });

    frames.push(frame);
  }

  return () => {
    for (const frame of frames) {
      const pre = frame.querySelector("pre");
      if (!pre) continue;
      frame.parentNode?.insertBefore(pre, frame);
      frame.remove();
    }
  };
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command failed");
}

function setButtonState(button: HTMLButtonElement, state: "idle" | "copied" | "failed"): void {
  button.dataset.state = state;
  button.setAttribute("aria-label", state === "copied" ? "복사됨" : state === "failed" ? "복사 실패" : "코드 복사");
  button.title = state === "copied" ? "복사됨" : state === "failed" ? "복사 실패" : "코드 복사";

  if (state !== "idle") {
    window.setTimeout(() => setButtonState(button, "idle"), 1400);
  }
}

function bindTocActivation(): () => void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]"));
  if (links.length === 0) return () => {};

  const getLinkId = (link: HTMLAnchorElement) => link.dataset.headingId ?? link.getAttribute("href")?.slice(1) ?? "";
  const headings = links
    .map((link) => document.getElementById(getLinkId(link)))
    .filter((heading): heading is HTMLElement => Boolean(heading));
  let activeId = "";
  let ticking = false;

  const setActive = (id: string) => {
    if (id === activeId) return;
    activeId = id;

    links.forEach((link) => {
      const isActive = getLinkId(link) === id;
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
      link.closest("li")?.classList.toggle("is-active", isActive);
    });
  };

  const activateClosestHeading = () => {
    const activationLine = Math.min(window.innerHeight * 0.28, 160);
    let current = headings[0];

    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > activationLine) break;
      current = heading;
    }

    if (current) setActive(current.id);
  };

  const scheduleActivation = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      activateClosestHeading();
      ticking = false;
    });
  };

  const clickHandlers = links.map((link) => {
    const handler = () => setActive(getLinkId(link));
    link.addEventListener("click", handler);
    return () => link.removeEventListener("click", handler);
  });

  activateClosestHeading();
  window.addEventListener("scroll", scheduleActivation, { passive: true });
  window.addEventListener("hashchange", scheduleActivation);
  window.addEventListener("resize", scheduleActivation, { passive: true });

  return () => {
    clickHandlers.forEach((cleanup) => cleanup());
    window.removeEventListener("scroll", scheduleActivation);
    window.removeEventListener("hashchange", scheduleActivation);
    window.removeEventListener("resize", scheduleActivation);
  };
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
