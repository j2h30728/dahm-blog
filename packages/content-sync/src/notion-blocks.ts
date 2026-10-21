type Block = { line: string; children: Block[] };

const listMarker = /^(?:[-+*]|\d+[.)])[ \t]+/;
const lineBreak = /<br\s*\/?\s*>/g;

function inline(text: string): string {
  return text.split(lineBreak).map((part, index) => index === 0 ? part : part
    .replace(/^( *)(#{1,6}|>|[-+*])(?=\s|$)/, "$1\\$2")
    .replace(/^( *\d+)([.)])(?=\s)/, "$1\\$2")
    .replace(/^( *)(-{3,}|={3,})( *)$/, "$1\\$2$3")).join("\\\n");
}

function quoteText(text: string): string {
  const lines = text.split(lineBreak);
  const result: string[] = [];
  let previousList = false;
  for (const line of lines) {
    const list = listMarker.test(line);
    if (line && result.at(-1) && list !== previousList) result.push("");
    result.push(line);
    previousList = list;
  }
  return result.join("\n");
}

function render(blocks: Block[]): string {
  const output: string[] = [];
  let previousKind = "";
  for (const block of blocks) {
    const { line, children } = block;
    if (!line.trim()) { previousKind = ""; continue; }
    const marker = listMarker.exec(line)?.[0];
    const kind = marker ? (/^\d/.test(marker) ? "ol" : "ul") : line.startsWith("|") ? "table" : "";
    const child = render(children);
    let value: string;
    if (line.startsWith(">")) {
      const content = quoteText(line.replace(/^> ?/, "")) + (child ? `\n\n${child}` : "");
      value = content.split("\n").map(part => part ? `> ${part}` : ">").join("\n");
    } else if (marker) {
      const indent = " ".repeat(marker.length);
      value = marker + inline(line.slice(marker.length)).replace(/\n/g, `\n${indent}`);
      if (child) value += (listMarker.test(children[0].line) ? "\n" : "\n\n")
        + child.split("\n").map(part => part ? indent + part : "").join("\n");
    } else {
      value = inline(line);
      if (child) value += `\n\n${child}`;
    }
    if (kind && kind === previousKind) output[output.length - 1] += `\n${value}`;
    else output.push(value);
    previousKind = kind;
  }
  return output.join("\n\n");
}

/** Notion v1은 블록 사이에 단일 개행, 내부 개행에 <br>, 자식에 탭을 쓴다. */
export function emitNotionBlocks(source: string): string {
  const root: Block[] = [];
  const levels = [root];
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) { levels.at(-1)!.push({ line: "", children: [] }); continue; }
    const depth = /^\t*/.exec(line)![0].length;
    while (levels.length <= depth) {
      const parent = levels.at(-1)!.filter(block => block.line.trim()).at(-1);
      if (!parent) throw new Error("Notion 하위 블록의 부모가 없습니다.");
      levels.push(parent.children);
    }
    levels.length = depth + 1;
    levels[depth].push({ line: line.slice(depth), children: [] });
  }
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const leading = /^(?:\r?\n)+/.exec(source)?.[0] ?? "";
  return leading + render(root).replace(/\n/g, newline);
}
