export default function rehypeImages() {
  return tree => {
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'pre' && String(node.properties?.style ?? '').includes('--shiki-dark')) {
        const classes = node.properties.className ?? [];
        node.properties.className = [...new Set([...(Array.isArray(classes) ? classes : String(classes).split(/\s+/)), 'shiki'])];
      }
      if (node.type === 'element' && node.tagName === 'img') {
        const props = node.properties ??= {};
        const match = /^obsidian-size=(\d+)(?:x(\d+))?$/.exec(String(props.title ?? ''));
        if (match) {
          const width = Number(match[1]);
          const height = match[2] ? Number(match[2]) : undefined;
          if (width < 1 || width > 10000 || (height && height > 10000)) throw new Error('이미지 크기 범위 오류');
          props.width = width;
          if (height) props.height = height;
          props['data-image-width'] = width;
          delete props.title;
        }
        props.loading = 'lazy';
        props.decoding = 'async';
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
