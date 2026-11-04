function headingText(node) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(headingText).join("");
}

function literal(value) {
  return { type: "Literal", value };
}

function property(name, value) {
  return {
    type: "Property",
    key: { type: "Identifier", name },
    value: literal(value),
    kind: "init",
    method: false,
    shorthand: false,
    computed: false,
  };
}

/** rehype-slug가 만든 실제 본문 ID를 목차에서도 그대로 사용한다. */
export default function rehypePostHeadings() {
  return (tree) => {
    const headings = [];
    function visit(node) {
      if (node.type === "element" && (node.tagName === "h2" || node.tagName === "h3")) {
        const id = node.properties?.id;
        if (typeof id !== "string") throw new Error("목차 수집 전에 본문 heading ID를 생성해야 합니다.");
        headings.push({ depth: Number(node.tagName.slice(1)), id, text: headingText(node).replace(/\s+/g, " ").trim() });
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);

    tree.children.push({
      type: "mdxjsEsm",
      value: "",
      data: {
        estree: {
          type: "Program",
          sourceType: "module",
          body: [{
            type: "ExportNamedDeclaration",
            declaration: {
              type: "VariableDeclaration",
              kind: "const",
              declarations: [{
                type: "VariableDeclarator",
                id: { type: "Identifier", name: "tableOfContents" },
                init: {
                  type: "ArrayExpression",
                  elements: headings.map((heading) => ({
                    type: "ObjectExpression",
                    properties: Object.entries(heading).map(([name, value]) => property(name, value)),
                  })),
                },
              }],
            },
            specifiers: [],
            source: null,
          }],
        },
      },
    });
  };
}
