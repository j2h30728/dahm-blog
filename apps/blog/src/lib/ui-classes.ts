export const ui = {
  siteHeader:
    "sticky top-0 z-10 border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur-[18px]",
  nav:
    "mx-auto flex max-w-[1120px] items-center justify-between gap-6 px-6 py-4 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3 max-[640px]:px-[18px] max-[640px]:py-3.5",
  brand:
    "inline-flex items-center gap-2.5 text-[var(--ink)] font-[780] tracking-[0] transition-opacity duration-[160ms] hover:opacity-80",
  brandMark:
    "inline-block h-[18px] w-[18px] rounded-md bg-[linear-gradient(135deg,var(--accent),var(--teal)_58%,var(--rust))] bg-[length:250%_250%] animate-[brand-gradient_6s_ease-in-out_infinite]",
  navLinks:
    "flex items-center gap-1.5 text-[0.92rem] max-[640px]:w-full",
  navLink:
    "relative rounded-lg px-2.5 py-2 text-[var(--muted-strong)] transition-[background,color] duration-[160ms] after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-[1px] after:bg-[linear-gradient(90deg,var(--accent),var(--teal))] after:transition-transform after:duration-[220ms] after:ease-[var(--ease-out-expo)] after:content-[''] hover:bg-[var(--soft)] hover:text-[var(--ink)] hover:no-underline hover:after:scale-x-100 max-[640px]:px-2",
  shell:
    "mx-auto max-w-[1120px] px-6 pb-[88px] pt-14 max-[640px]:px-[18px] max-[640px]:pb-16 max-[640px]:pt-[38px]",

  homeIntro:
    "home-intro grid grid-cols-[minmax(0,1fr)_auto] gap-6 border-b border-[var(--line)] pb-[34px] pt-2.5 transition-[opacity,transform] duration-[600ms] ease-[var(--ease-out-expo)] max-[860px]:grid-cols-1",
  minWidthZero: "min-w-0",
  tagline:
    "tagline mb-3 block text-[0.76rem] font-[760] uppercase tracking-[0.12em] text-[var(--rust)]",
  pageTitle:
    "page-title mb-4 max-w-[820px] text-[clamp(2.35rem,6vw,4.25rem)] font-[760] leading-none tracking-[0] text-[var(--ink)] text-balance transition-[opacity,transform] delay-100 duration-[700ms] ease-[var(--ease-out-expo)] max-[640px]:text-[clamp(2.2rem,14vw,3.25rem)]",
  pageSubtitle:
    "m-0 max-w-[720px] wrap-anywhere text-[clamp(1rem,2vw,1.18rem)] text-[var(--muted)]",
  homeSummary:
    "flex max-w-[260px] flex-wrap justify-end gap-2.5 self-end max-[860px]:max-w-none max-[860px]:justify-start",
  summaryPill:
    "rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-[7px] text-[0.82rem] font-[680] leading-none text-[var(--muted)]",

  latestStrip:
    "latest-strip relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 overflow-hidden border-b border-[var(--line)] py-[26px] max-[860px]:grid-cols-1",
  latestGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,color-mix(in_srgb,var(--accent)_3%,transparent)_0%,transparent_65%)]",
  latestTitle:
    "mb-2 mt-0 max-w-[760px] text-[clamp(1.35rem,3vw,2rem)] leading-[1.12] text-balance",
  latestLink:
    "bg-[linear-gradient(var(--accent-ink),var(--accent-ink))] bg-[length:0%_2px] bg-left-bottom bg-no-repeat text-inherit transition-[color,background-size] duration-[240ms] ease-[var(--ease-out-expo)] hover:bg-[length:100%_2px] hover:text-[var(--accent-ink)]",
  latestDescription:
    "m-0 max-w-[760px] wrap-anywhere text-[var(--muted-strong)]",
  latestDate:
    "whitespace-nowrap text-[0.88rem] font-[760] text-[var(--accent-ink)]",

  topicRail:
    "grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6 my-7 mb-11 max-[860px]:grid-cols-1",
  sectionTitle:
    "m-0 text-[clamp(1.45rem,3vw,2rem)] leading-[1.12]",
  tagList: "flex flex-wrap gap-2",
  tagPill:
    "tag rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-[7px] text-[0.82rem] font-[680] leading-none text-[var(--ink-soft)] transition-[background,border-color,color,transform,box-shadow] duration-[200ms] ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:scale-[1.02] hover:border-[color-mix(in_srgb,var(--accent)_34%,var(--line))] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] hover:shadow-[0_2px_10px_rgb(29_31_27_/_6%)] hover:no-underline",
  archiveSection: "mt-12",
  sectionHeading: "mb-[18px] flex items-end justify-between",

  postList: "post-list grid gap-3.5",
  postCard:
    "post-item rounded-lg border border-[var(--line)] bg-[var(--paper)] transition-[border-color,box-shadow,transform] duration-[240ms] ease-[var(--ease-spring)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--accent)_34%,var(--line))] hover:shadow-[var(--glow-sm)]",
  postCardLink:
    "block px-[22px] py-5 text-inherit hover:no-underline max-[640px]:p-[18px]",
  postTopline:
    "mb-[9px] flex flex-wrap items-center justify-between gap-2.5 text-[0.8rem] font-[720] uppercase text-[var(--muted)] max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-[3px]",
  postSeries: "tracking-[0.08em] text-[var(--teal)]",
  postDate: "tracking-[0.04em]",
  postTitle:
    "mb-2 mt-0 block text-[clamp(1.28rem,2.4vw,1.7rem)] leading-[1.16] text-balance",
  postDescription:
    "m-0 mb-4 max-w-[760px] text-[var(--muted-strong)]",
  postTagList: "post-tags flex flex-wrap gap-2",

  meta:
    "meta my-3 mb-[30px] flex flex-wrap items-center gap-2 text-[var(--muted)]",
  postLayout:
    "post-layout grid grid-cols-[minmax(0,1fr)_260px] gap-12 max-[860px]:grid-cols-1",
  contentPanel:
    "content min-w-0 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-[clamp(22px,4vw,44px)] shadow-[0_14px_36px_rgb(29_31_27_/_6%)] max-[640px]:p-[18px]",

  toc:
    "toc sticky top-[84px] self-start rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 transition-shadow duration-[200ms] hover:shadow-[var(--glow-sm)] max-[860px]:static",
  tocTitle:
    "mb-2.5 mt-0 text-[0.84rem] uppercase tracking-[0.08em] text-[var(--ink)]",
  tocList: "m-0 list-none p-0",
  tocItem: "my-[7px]",
  tocItemNested: "pl-[14px]",
  tocLink:
    "text-[0.9rem] text-[var(--muted-strong)] transition-colors duration-[160ms] hover:text-[var(--accent-ink)]",

  relatedSection:
    "related mt-12 border-t border-[var(--line)] pt-[26px]",
  relatedTitle: "mb-4 mt-0 text-[1.35rem]",
  relatedGrid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3",
  relatedCard:
    "related-card rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-inherit transition-[border-color,box-shadow,transform] duration-[200ms] ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_34%,var(--line))] hover:shadow-[var(--glow-sm)] hover:no-underline",
  relatedKicker:
    "mb-1.5 block text-[0.76rem] font-[760] uppercase tracking-[0.08em] text-[var(--teal)]",
  relatedMeta: "text-[var(--muted)]",
  relatedDescription: "m-0 mt-2 text-[var(--muted)]",

  searchBox:
    "search-box mb-6 w-full max-w-[620px] rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-3.5 py-[13px] text-[var(--ink)] shadow-[0_10px_28px_rgb(29_31_27_/_5%)] transition-[border-color,box-shadow] duration-[200ms] focus:border-[color-mix(in_srgb,var(--accent)_42%,var(--line))] focus:shadow-[var(--glow-sm)] focus:outline-none",

  themeToggle:
    "theme-toggle group flex cursor-pointer items-center rounded-lg border-0 bg-transparent px-2.5 py-2 leading-none text-[var(--muted-strong)] transition-[background,color,transform] duration-[200ms] ease-[var(--ease-spring)] hover:scale-110 hover:rotate-12 hover:bg-[var(--soft)] hover:text-[var(--ink)]",
  themeToggleLightIcon: "hidden group-data-[current=light]:flex",
  themeToggleDarkIcon: "hidden group-data-[current=dark]:flex",
} as const;
