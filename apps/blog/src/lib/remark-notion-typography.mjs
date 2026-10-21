const cjk = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const punctuation = /[\p{P}\p{S}]/u;

function cjkStrongText(node, source) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  // escape·문자 참조를 파서가 해석한 text는 다시 Markdown으로 해석하지 않는다.
  if (typeof start !== "number" || typeof end !== "number"
    || source.slice(start, end).replace(/\r\n?/g, "\n") !== node.value) return [node];

  const children = [];
  let cursor = 0;
  for (const match of node.value.matchAll(/(?<!\*)\*\*(?!\*)([^\r\n*]+)\*\*(?!\*)/g)) {
    const label = match[1];
    const before = Array.from(node.value.slice(0, match.index)).at(-1) ?? "";
    const after = Array.from(node.value.slice(match.index + match[0].length))[0] ?? "";
    const first = Array.from(label)[0];
    const last = Array.from(label).at(-1);
    // CommonMark에서 문자로 남은 CJK/문장부호 경계의 짝 맞는 **만 보완한다.
    if (!(cjk.test(before) && punctuation.test(first))
      && !(punctuation.test(last) && cjk.test(after))) continue;
    if (match.index > cursor) children.push({ type: "text", value: node.value.slice(cursor, match.index) });
    children.push({ type: "strong", children: [{ type: "text", value: label }] });
    cursor = match.index + match[0].length;
  }
  if (cursor === 0) return [node];
  if (cursor < node.value.length) children.push({ type: "text", value: node.value.slice(cursor) });
  return children;
}

// Notion 본문의 개행과 CJK 인라인 강조를 보존하고 문서·코드 구조는 유지한다.
export default function remarkNotionTypography() {
  function transformInline(parent, source, preserveBreaks) {
    parent.children = parent.children.flatMap((node) => {
      if (node.type === "text") {
        const children = cjkStrongText(node, source);
        return preserveBreaks ? children.flatMap(splitLineBreaks) : children;
      }
      if (["emphasis", "strong", "delete", "link", "linkReference"].includes(node.type)) {
        transformInline(node, source, preserveBreaks);
      }
      return [node];
    });
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
