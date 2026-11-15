import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseScores, observationSchema } from "../src/lib/validation";
import { enrichDiagnostic, digest, compileFixPlan, editorInstructions, fixEditPrompt, validateFixPlan } from "../src/lib/diagnostics";
import { defaultSettings, pillars } from "../src/lib/types";

beforeEach(() => vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64)));
afterEach(() => vi.unstubAllEnvs());
const image = Buffer.from("fixture-image");
const empty = { exactText: [], requiredObjects: [], forbiddenChanges: [] };
function score(suggestion = "Make the face 30% larger and move it left. Keep the text ¿SE LE VOLTEARON?") {
  const observations = observationSchema.parse({
    summary: "s",
    readableText: "¿SE LE VOLTEARON?",
    dimensions: Object.fromEntries(
      pillars.map((p) => [p, { observation: "seen " + p, strength: "s", weakness: "w", fix: "f", flags: p === "emotion" ? ["no_readable_emotion"] : p === "virality" ? ["fatigued_format"] : [], suggestions: ["pillar fix " + p] }]),
    ),
    suggestion,
    keep: ["the man's face", "the teal background"],
    keepText: ["¿SE LE VOLTEARON?"],
  });
  const answers = { answers: { virality: { score: 1, confidence: 0.8 }, clarity: { score: 3, confidence: 0.8 }, idea: { score: 2, confidence: 0.8 }, curiosity: { score: 3, confidence: 0.8 }, emotion: { score: 2, confidence: 0.8 } } };
  return enrichDiagnostic(parseScores(answers, observations, "Petro"), image, "Petro", { videoBrief: "", audience: "", includeVision: true }, { width: 200, height: 113, digest: digest("p") }, true);
}

it("uses the single suggestion verbatim as the only operation, and keep → preserve", () => {
  const s = score();
  const history = [{ suggestion: "Earlier fix", before: 60, after: 70 }];
  const r = compileFixPlan(s, "src", digest(image), defaultSettings, { exactText: [], requiredObjects: ["user object"], forbiddenChanges: ["No logos"] }, undefined, history);
  expect(r.kind).toBe("ready");
  if (r.kind !== "ready") return;
  expect(r.plan.operations).toHaveLength(1);
  expect(r.plan.operations[0].instruction).toBe(s.suggestion);
  // Worst flagged pillar: emotion (67) and virality (33) are flagged → virality.
  expect(r.plan.operations[0].pillar).toBe("virality");
  expect(r.plan.preserve.exactText).toEqual(["¿SE LE VOLTEARON?"]);
  expect(r.plan.preserve.requiredObjects).toEqual(["user object", "the man's face", "the teal background"]);
  expect(r.plan.preserve.forbiddenChanges).toEqual(["No logos"]);
  expect(r.plan.history).toEqual(history);
  expect(() => validateFixPlan(r.plan, "src", image, s, defaultSettings)).not.toThrow();
  expect(() => validateFixPlan({ ...r.plan, suggestion: "Replace the text with SIN MAYORÍA" }, "src", image, s, defaultSettings)).toThrow();
});

it("the fix prompt makes the mediator an editor: only this change, keep list, no new concept", () => {
  const r = compileFixPlan(score(), "src", digest(image), defaultSettings, empty);
  if (r.kind !== "ready") throw new Error("not ready");
  const prompt = fixEditPrompt(r.plan);
  expect(prompt.startsWith("Edit the attached original image. Apply only this change: Make the face 30% larger")).toBe(true);
  expect(prompt).toContain("Keep everything else identical, including:");
  expect(prompt).toContain('the exact on-image text "¿SE LE VOLTEARON?"');
  expect(prompt).toContain("the man's face; the teal background");
  expect(prompt).toContain("Do not invent a new concept or new on-image text unless the change asks for it.");
  expect(editorInstructions(r.plan)).toContain("Apply only this change");
});

it("falls back to the per-pillar issues for older scores without a suggestion", () => {
  const s = { ...score(""), suggestion: undefined };
  const r = compileFixPlan(s, "src", digest(image), defaultSettings, empty);
  if (r.kind !== "ready") throw new Error("not ready");
  expect(r.plan.suggestion).toBeUndefined();
  expect(r.plan.operations.length).toBeGreaterThan(1);
  expect(editorInstructions(r.plan)).toContain("Execute only this reviewed image-edit plan");
});

it("still refuses multi-image fixes and blocked diagnostics", () => {
  expect(() => compileFixPlan(score(), "src", digest(image), { ...defaultSettings, batch: 4 }, empty)).toThrow();
  expect(compileFixPlan({ ...score(), fixBlocked: true }, "src", digest(image), defaultSettings, empty).kind).toBe("blocked");
});
