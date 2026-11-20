import { it, expect } from "vitest";
import { fixPrompt } from "../src/lib/fix-prompt";
import type { Evaluation } from "../src/lib/types";

const dim = (score: number | null, fix: string) => ({ score, confidence: 0.8, observation: "o", strength: "s", weakness: "w", fix });
const evaluation = (dims: Record<string, ReturnType<typeof dim>>) => ({ source: "jev", version: 3, overall: 60, title: "Why Nokia Lost", note: "", priority: "clarity", created_at: "", dimensions: dims } as unknown as Evaluation);

it("orders fixes weakest pillar first and keeps identity and wording", () => {
  const prompt = fixPrompt(evaluation({ virality: dim(80, "Add one surprising object."), clarity: dim(40, "Enlarge the face."), idea: dim(55, "Show the phone."), curiosity: dim(null, "ignored"), emotion: dim(70, "") }))!;
  expect(prompt.indexOf("clarity (40/100)")).toBeLessThan(prompt.indexOf("idea (55/100)"));
  expect(prompt.indexOf("idea (55/100)")).toBeLessThan(prompt.indexOf("virality (80/100)"));
  expect(prompt).not.toContain("ignored");
  expect(prompt).not.toContain("emotion (");
  expect(prompt).toContain('"Why Nokia Lost"');
  expect(prompt).toContain("must not repeat the title");
});
it("labels generic rubric advice in copied prompts", () => {
  const value=evaluation({virality:dim(80,""),clarity:dim(57,"Improve contrast"),idea:dim(81,""),curiosity:dim(62,""),emotion:dim(63,"")});
  value.dimensions.clarity.generalAdvice=true;
  expect(fixPrompt(value)).toContain("clarity (57/100): General advice: Improve contrast");
});
it("supplies general advice for an older score and orders by its numbers", () => {
  const value=evaluation({virality:dim(80,""),clarity:dim(57,""),idea:dim(81,"Add an object"),curiosity:dim(72,""),emotion:dim(63,"Show emotion")});
  value.dimensions.clarity.weakness="";
  const prompt=fixPrompt(value)!;
  expect(prompt).toContain("clarity (57/100): General advice:");
  expect(prompt.indexOf("clarity (57/100)")).toBeLessThan(prompt.indexOf("emotion (63/100)"));
});
it("returns null when no concrete change is supported", () => {
  expect(fixPrompt(evaluation({ virality: dim(80, ""), clarity: dim(null, "x"), idea: dim(90, " "), curiosity: dim(70, ""), emotion: dim(75, "") }))).toBeNull();
});
