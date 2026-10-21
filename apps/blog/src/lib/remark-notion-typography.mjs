const cjk = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const punctuation = /[\p{P}\p{S}]/u;

function sourceMatchesText(node, source) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return typeof start === "number" && typeof end === "number"
    && source.slice(start, end).replace(/\r\n?/g, "\n") === node.value;
}

function inlineText(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  return node.children?.map(inlineText).join("") ?? "";
}

function splitDelimiterTokens(node, source) {
  // escape·문자 참조를 파서가 해석한 text는 다시 Markdown으로 해석하지 않는다.
  if (node.type !== "text" || !sourceMatchesText(node, source)) return [node];

  const tokens = [];
  let cursor = 0;
  for (const match of node.value.matchAll(/(?<!\*)\*{2,3}(?!\*)/g)) {
    if (match.index > cursor) tokens.push({ type: "text", value: node.value.slice(cursor, match.index) });
    tokens.push({ type: "notionDelimiter", value: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor === 0) return [node];
  if (cursor < node.value.length) tokens.push({ type: "text", value: node.value.slice(cursor) });
  return tokens;
}

function edgeCharacter(nodes, fromEnd) {
  const value = nodes.map(inlineText).join("");
  return fromEnd ? Array.from(value).at(-1) ?? "" : Array.from(value)[0] ?? "";
}

function trimInlineWhitespace(nodes) {
  const content = [...nodes];
  let leading = "";
  let trailing = "";

  if (content[0]?.type === "text") {
    leading = content[0].value.match(/^\s+/u)?.[0] ?? "";
    content[0] = { ...content[0], value: content[0].value.slice(leading.length) };
  }
  if (content.at(-1)?.type === "text") {
    trailing = content.at(-1).value.match(/\s+$/u)?.[0] ?? "";
    content[content.length - 1] = {
      ...content.at(-1),
      value: content.at(-1).value.slice(0, content.at(-1).value.length - trailing.length),
    };
  }

  return {
    content: content.filter((node) => node.type !== "text" || node.value),
    leading,
    trailing,
  };
}

function isCjkBoundaryRepair(before, content, after, hadEdgeWhitespace) {
  const label = content.map(inlineText).join("");
  const first = Array.from(label)[0] ?? "";
  const last = Array.from(label).at(-1) ?? "";
  const hasStructuredChild = content.some((node) => node.type !== "text");

  return cjk.test(label)
    || (cjk.test(before) && punctuation.test(first))
    || (punctuation.test(last) && cjk.test(after))
    || (!hadEdgeWhitespace && (cjk.test(before) || cjk.test(after)))
    || (hasStructuredChild && (cjk.test(before) || cjk.test(after)));
}

function wrappedDelimiter(value, children) {
  const strong = { type: "strong", children };
  return value === "***" ? { type: "emphasis", children: [strong] } : strong;
}

function repairInlineDelimiters(parent, source) {
  let tokens = parent.children.flatMap((node) => splitDelimiterTokens(node, source));

  for (let opening = 0; opening < tokens.length; opening++) {
    const delimiter = tokens[opening];
    if (delimiter.type !== "notionDelimiter") continue;
    const closing = tokens.findIndex((node, index) => index > opening
      && node.type === "notionDelimiter" && node.value === delimiter.value);
    if (closing < 0) continue;

    const { content, leading, trailing } = trimInlineWhitespace(tokens.slice(opening + 1, closing));
    if (content.length === 0) continue;
    const before = edgeCharacter(tokens.slice(0, opening), true);
    const after = edgeCharacter(tokens.slice(closing + 1), false);
    if (!isCjkBoundaryRepair(before, content, after, Boolean(leading || trailing))) continue;

    const replacement = [];
    if (leading) replacement.push({ type: "text", value: leading });
    replacement.push(wrappedDelimiter(delimiter.value, content));
    if (trailing) replacement.push({ type: "text", value: trailing });
    tokens = [...tokens.slice(0, opening), ...replacement, ...tokens.slice(closing + 1)];
    opening--;
  }

  parent.children = tokens.map((node) => node.type === "notionDelimiter"
    ? { type: "text", value: node.value }
    : node);
}

function removeRedundantStrongBoundary(parent, source) {
  if (parent.type !== "strong") return;
  parent.children = parent.children.map((node, index) => {
    if (index === 0 || node.type !== "text" || !node.value.startsWith("****")
      || !sourceMatchesText(node, source)) return node;
    return { ...node, value: node.value.slice(4) };
  }).filter((node) => node.type !== "text" || node.value);
}

// Notion 본문의 개행과 CJK 인라인 강조를 보존하고 문서·코드 구조는 유지한다.
export default function remarkNotionTypography() {
  function transformInline(parent, source, preserveBreaks) {
    parent.children.forEach((node) => {
      if (["emphasis", "strong", "delete", "link", "linkReference"].includes(node.type)) {
        transformInline(node, source, preserveBreaks);
      }
    });
    removeRedundantStrongBoundary(parent, source);
    repairInlineDelimiters(parent, source);
    if (preserveBreaks) parent.children = parent.children.flatMap(splitLineBreaks);
  }

  function splitLineBreaks(node) {
    if (node.type === "text" && /[\r\n]/.test(node.value)) {
      const result = [];
      node.value.split(/\r\n|\r|\n/).forEach((value, index) => {
        if (index > 0) result.push({ type: "break" });
        if (value) result.push({ type: "text", value });
      });
      return result;
    }
    return [node];
  }

  function visit(node, source) {
    if (node.type === "paragraph") {
      transformInline(node, source, true);
    } else if (node.type === "heading" || node.type === "tableCell") {
      transformInline(node, source, false);
    } else if (!node.type.startsWith("mdx") && node.children) {
      node.children.forEach(child => visit(child, source));
    }
  }

  return (tree, file) => visit(tree, String(file));
}
