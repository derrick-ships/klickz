import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
const { parse } = require("next/dist/compiled/babel/parser") as { parse: (source: string, options: object) => any };

const apiKeyAllowed = ["src/app/connect/page.tsx", "src/components/account/account.tsx", "src/components/account/codex-connection.tsx"];
const banned = /\b(?:API|provider|model|token|MCP|OAuth|Jev|Flare|Sunburst|lever|rubric|mediator|lineage|batch|reconciling|Planning effort|Profile preparation provider)\b/gi;
const attributes = new Set(["aria-label", "title", "placeholder", "alt", "label"]);

function checkCopy(source: string, path = "fixture.tsx"): string[] {
  const file = parse(source, { sourceType: "module", plugins: ["jsx", "typescript"] });
  const markers = (file.comments as any[]).filter(c => /^\s*copy-law:\s*(advanced|end)\s*$/.test(c.value)).sort((a, b) => a.start - b.start);
  const advanced = (position: number) => {
    let depth = 0;
    for (const marker of markers) {
      if (marker.start >= position) break;
      depth += /advanced/.test(marker.value) ? 1 : -1;
      depth = Math.max(0, depth);
    }
    return depth > 0;
  };
  const problems: string[] = [];
  const report = (text: string, node: any) => {
    if (!text.trim() || advanced(node.start)) return;
    const checked = apiKeyAllowed.includes(path) ? text.replace(/\bAPI\s+key\b/gi, "") : text;
    for (const match of checked.matchAll(banned)) problems.push(`${node.loc.start.line}: banned ${match[0]}: ${text.trim()}`);
  };
  function expression(node: any) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(expression); return; }
    if (node.type === "JSXElement" || node.type === "JSXFragment") { walk(node); return; }
    if (node.type === "ConditionalExpression") { expression(node.consequent); expression(node.alternate); return; }
    if (node.type === "LogicalExpression") { expression(node.right); return; }
    if (["BinaryExpression", "CallExpression", "MemberExpression"].includes(node.type)) return;
    if (node.type === "StringLiteral" || node.type === "TemplateElement") report(node.type === "TemplateElement" ? node.value.cooked ?? node.value.raw : node.value, node);
    for (const [key, value] of Object.entries(node)) if (!["loc", "comments", "extra", "value"].includes(key)) expression(value);
  }
  function staticText(node: any): string {
    if (!node) return "";
    if (Array.isArray(node)) return node.map(staticText).join(" ");
    if (node.type === "JSXText" || node.type === "StringLiteral") return node.value;
    if (node.type === "TemplateLiteral") return node.quasis.map(staticText).join(" ");
    if (node.type === "TemplateElement") return node.value.cooked ?? node.value.raw;
    if (node.type === "JSXExpressionContainer") return staticText(node.expression);
    if (node.type === "ConditionalExpression") return [staticText(node.consequent), staticText(node.alternate)].sort((a, b) => b.trim().split(/\s+/).length - a.trim().split(/\s+/).length)[0];
    if (node.type === "LogicalExpression") return staticText(node.right);
    if (node.type === "JSXElement") return staticText(node.children);
    return "";
  }
  function walk(node: any): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === "JSXText") { report(node.value, node); return; }
    if (node.type === "JSXExpressionContainer") { expression(node.expression); return; }
    if (node.type === "JSXAttribute") {
      if (attributes.has(node.name.name) && node.value) {
        if (node.value.type === "StringLiteral") report(node.value.value, node.value);
        else expression(node.value.expression);
      }
      return;
    }
    if (node.type === "JSXElement") {
      const opening = node.openingElement;
      if (opening.name.name === "button" && !advanced(node.start) && !opening.attributes.some((a: any) => a.name?.name === "data-copy-law" && a.value?.value === "allow-long")) {
        const text = staticText(node.children).trim();
        if (text && text.split(/\s+/).length > 2) problems.push(`${node.loc.start.line}: long button: ${text}`);
      }
      walk(opening.attributes); walk(node.children); return;
    }
    for (const [key, value] of Object.entries(node)) if (!["loc", "comments", "tokens", "extra"].includes(key)) walk(value);
  }
  walk(file.program);
  return problems;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(`${dir}/${entry.name}`) : entry.name === "page.tsx" ? [`${dir}/${entry.name}`] : []);
}
const copyLawFiles = ["src/components/studio.tsx", "src/components/welcome.tsx", "src/components/review-canvas.tsx", "src/app/not-found.tsx", ...["src/components/creative", "src/components/account"].flatMap(dir => readdirSync(dir).filter(name => name.endsWith(".tsx")).map(name => `${dir}/${name}`)), ...filesUnder("src/app")];

describe("copy law checker", () => {
  it.each([
    ['<p>{"model"}</p>', "banned model"],
    ['<p>{ok ? "model" : "fine"}</p>', "banned model"],
    ['<p aria-label="model" />', "banned model"],
    ['<button>Make a picture</button>', "long button"],
  ])("rejects %s", (source, expected) => expect(checkCopy(`const x = ${source}` ).join("\n")).toContain(expected));
  it("accepts marked advanced copy", () => expect(checkCopy('const x = <>{/* copy-law: advanced */}<p>{"model"}</p>{/* copy-law: end */}</>')).toEqual([]));
  it("accepts line-comment markers", () => expect(checkCopy('// copy-law: advanced\nconst x = <p>model</p>;\n// copy-law: end\nconst y = <p>Fine</p>;')).toEqual([]));
});
describe("default copy", () => {
  for (const path of [...new Set(copyLawFiles)].sort()) it(path, () => expect(checkCopy(readFileSync(path, "utf8"), path)).toEqual([]));
});
