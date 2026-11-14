import { it, expect } from "vitest";
import { personaIdentityContract, realismContract, generationInstructions } from "../src/lib/instructions";
import { defaultSettings } from "../src/lib/types";

it("persona identity contract names the exact reference slots and forbids look-alikes", () => {
  const text = personaIdentityContract("Guillo", 1, 3);
  expect(text).toContain("reference images 1-3");
  expect(text).toContain("Do not beautify");
  expect(text).toContain("Do not introduce a different person");
});

it("every generation prompt carries the realism contract", () => {
  const prompt = generationInstructions({ settings: defaultSettings, title: "", prompt: "A portrait", style: "Auto", notes: [], variation: 1 });
  expect(prompt).toContain(realismContract);
  expect(prompt).toContain("plastic or porcelain skin");
});
