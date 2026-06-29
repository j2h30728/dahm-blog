import type { Heading } from "../lib/posts";
import { ui } from "../lib/ui-classes";

interface TocProps {
  headings: Heading[];
}

export function Toc({ headings }: TocProps) {
  const eligible = headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
  if (eligible.length === 0) return null;

  return (
    <nav aria-labelledby="toc-title" className={ui.toc} data-toc>
      <h2 className={ui.tocTitle} id="toc-title">
        Contents
      </h2>
      <ol className={ui.tocList}>
        {eligible.map((heading) => (
          <li className={`${ui.tocItem} ${heading.depth === 3 ? ui.tocItemNested : ""} depth-${heading.depth}`} key={heading.id}>
            <a
              className={heading.depth === 3 ? ui.tocLinkNested : ui.tocLink}
              data-heading-id={heading.id}
              data-toc-link
              href={`#${heading.id}`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
