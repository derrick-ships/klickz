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
  expect(instructionVersion).toBe("openpikzels-harness-1.2-soul");
});
it("keeps the channel house style opt-in and every section sourced", () => {
  expect(source).toMatch(/Opt-in channel profile[\s\S]*Apply ONLY when/);
  const sections = source.split(/\n## /).slice(1);
  for (const section of sections.filter((s) => !s.startsWith("11. Limits"))) expect(section).toMatch(/Source: \d\d-/);
});
