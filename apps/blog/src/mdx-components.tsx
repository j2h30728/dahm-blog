import type { MDXComponents } from "mdx/types";
import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ZoomableImage, ZoomableImageLink } from "./components/ZoomableImage";

function containsImage(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ src?: unknown; children?: ReactNode }>(child)) return false;
    return typeof child.props.src === "string" || containsImage(child.props.children);
  });
}

function PostLink(props: ComponentPropsWithoutRef<"a">) {
  return containsImage(props.children) ? <ZoomableImageLink {...props} /> : <a {...props} />;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    img: ZoomableImage,
    a: PostLink,
    ...components,
  };
}
