import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// Next bundles the parser used by its own build.
const { parse } = require("next/dist/compiled/babel/parser") as { parse: (source: string, options: object) => Node };
type Node = { type: string; value?: string; name?: string | Node; children?: Node[]; openingElement?: Node; attributes?: Node[]; loc?: { start: { line: number } }; [key: string]: unknown };

export const copyLawFiles = [
  "src/components/welcome.tsx", "src/components/account/account.tsx",
  "src/components/account/sign-in.tsx", "src/components/account/consent.tsx",
  "src/app/connect/page.tsx", "src/app/local-companion/page.tsx", "src/app/not-found.tsx",
];
// TODO: Enable after the studio lane has adopted the copy law.
export const pendingFiles = ["src/components/studio.tsx"];
// These components render only inside the collapsed developer section.
export const advancedFiles = ["src/components/account/codex-connection.tsx", "src/components/account/models-panel.tsx"];
const banned = /\b(?:API|provider|model|token|MCP|OAuth|Jev|Flare|Sunburst|lever|rubric|mediator|lineage|batch|reconciling|Planning effort|Profile preparation provider)\b/i;

function visibleCopy(path: string) {
  const source = readFileSync(path, "utf8");
  const cleaned = source.replace(/\{\/\* copy-law: advanced \*\/\}[\s\S]*?\{\/\* copy-law: end \*\/\}/g, "");
  const file = parse(cleaned, { sourceType: "module", plugins: ["jsx", "typescript"] });
  const found: { text: string; line: number; button: boolean }[] = [];
  function walk(node: unknown, button = false) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(child => walk(child, button)); return; }
    const n = node as Node;
    if (n.type === "JSXText" && n.value?.trim()) found.push({ text: n.value.trim(), line: n.loc?.start.line || 0, button });
    if (n.type === "JSXAttribute" && typeof n.name === "object" && ["aria-label", "title", "placeholder"].includes(String(n.name?.name))) {
      const value = n.value as unknown as Node;
      if (value?.type === "StringLiteral" && value.value) found.push({ text: value.value, line: n.loc?.start.line || 0, button: false });
    }
    if (n.type === "JSXElement") {
      const tag = n.openingElement?.name as Node | undefined;
      walk(n.openingElement, false);
      walk(n.children, tag?.name === "button" && n.children?.length === 1);
      return;
    }
    for (const [key, value] of Object.entries(n)) if (key !== "loc" && key !== "tokens" && key !== "comments") walk(value, false);
  }
  walk(file);
  return found;
}

describe("default copy", () => {
  for (const path of copyLawFiles) it(path, () => {
    const problems = visibleCopy(path).flatMap(({ text, line, button }) => {
      // The privacy disclosure is collapsed, as is the alternate-AI chooser.
      const word = text.match(banned)?.[0];
      return [...(word ? [`${line}: banned ${word}: ${text}`] : []),
        ...(button && text.split(/\s+/).length > 3 ? [`${line}: long button: ${text}`] : [])];
    });
    expect(problems).toEqual([]);
  });
});
