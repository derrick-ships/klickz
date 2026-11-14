import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { soul } from "../src/lib/soul.generated";
import { agentGuide } from "../src/lib/mcp";
import { soulVisionInstructions, instructionVersion } from "../src/lib/instructions";

const sentinel = "SENTINEL RULE: The thumbnail never repeats the title.";
const source = readFileSync(new URL("../soul.md", import.meta.url), "utf8");

it("generates the server soul from soul.md without drift", () => {
  expect(soul).toBe(source);
  expect(source).toContain(sentinel);
});
it("loads the soul into the MCP agent guide and the image reviewer", () => {
  expect(agentGuide).toContain(sentinel);
  expect(soulVisionInstructions).toContain(sentinel);
  expect(soulVisionInstructions.indexOf(sentinel)).toBeLessThan(soulVisionInstructions.indexOf("Return JSON only"));
  expect(instructionVersion).toBe("openpikzels-harness-1.3-soul-ta");
});
it("keeps the channel house style opt-in and every section sourced", () => {
  expect(source).toMatch(/Opt-in channel profile[\s\S]*Apply ONLY when/);
  const sections = source.split(/\n## /).slice(1);
  for (const section of sections.filter((s) => !/^\d+\. Limits/.test(s))) expect(section).toMatch(/Source: (\d\d-|TA |comparison of the TA courses)/);
});

it("records course conflicts instead of silently overriding the playbook", () => {
  expect(source).toContain("Where the courses and the playbook disagree");
  expect(source).toMatch(/Never cite them as facts/);
  expect(source.indexOf("## 13. Where the courses")).toBeLessThan(source.indexOf("## 14. Open questions"));
});
