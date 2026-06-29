import Link from "next/link";
import type { Backlink } from "../lib/public-link-index";

interface BacklinksProps {
  backlinks: Backlink[];
}

export function Backlinks({ backlinks }: BacklinksProps) {
  const primaryBacklink = backlinks[0];
  if (!primaryBacklink) return null;

  const extraCount = Math.max(0, backlinks.length - 1);

  return (
    <section aria-labelledby="backlinks-title" className="backlinks-compact">
      <h2 className="backlinks-compact-title" id="backlinks-title">
        Backlinks
      </h2>
      <Link className="backlinks-compact-link" href={primaryBacklink.source.href}>
        <span className="backlinks-compact-source">{primaryBacklink.source.title}</span>
        {extraCount > 0 && <small className="backlinks-compact-count">+{extraCount}</small>}
      </Link>
    </section>
  );
}
