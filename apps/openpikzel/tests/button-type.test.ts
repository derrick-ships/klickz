import { it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// A <button> without type is a submit button inside a form: one stray click can submit (and
// charge) a paid request. Pikzels has exactly this bug. Every <button> must declare its type.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : []; });
}
it("every <button> in components declares type", () => {
  const missing: string[] = [];
  for (const file of [...files("src/components"), ...files("src/app")]) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<button\b([^>]*?)>/gs)) {
      if (!/\btype\s*=/.test(m[1]) && !/\{\.\.\.[^}]*\}/.test(m[1])) missing.push(`${file}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
  expect(missing, missing.slice(0, 20).join("\n")).toEqual([]);
});
