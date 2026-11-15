import { it, expect } from "vitest";
import { readFileSync } from "node:fs";

// OpenAI JSON mode (text.format json_object) rejects requests whose INPUT never says
// "json"; instructions don't count. Every call using it must say so in the input.
it("every json_object call says JSON in its input text", () => {
  for (const file of ["src/lib/providers.ts", "src/lib/mediator.ts", "src/lib/creative-text.ts", "src/lib/model-scorer.ts"]) {
    const src = readFileSync(file, "utf8");
    const calls = src.split("json_object").length - 1;
    const said = src.split("Answer in JSON").length - 1;
    expect(said, file).toBeGreaterThanOrEqual(calls);
  }
});
