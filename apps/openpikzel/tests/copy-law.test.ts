import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
  const found: { text: string; line: number; button: boolean }[] = [];
  const jsx = cleaned.slice(cleaned.lastIndexOf("return ("));
  const pattern = />\s*([^<>{}]+?)\s*</g;
  for (const match of jsx.matchAll(pattern)) {
    const prefix = jsx.slice(0, match.index);
    const button = /<button\b[^>]*>\s*$/.test(prefix) && /^\s*<\/button/.test(jsx.slice((match.index || 0) + match[0].length - 1));
    found.push({ text: match[1].trim(), line: prefix.split("\n").length, button });
  }
  for (const match of cleaned.matchAll(/\b(?:aria-label|title|placeholder)="([^"]+)"/g)) {
    found.push({ text: match[1], line: cleaned.slice(0, match.index).split("\n").length, button: false });
  }
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
