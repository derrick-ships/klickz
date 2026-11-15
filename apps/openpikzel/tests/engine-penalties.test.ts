import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseScores, observationSchema } from "../src/lib/validation";
import { enrichDiagnostic, digest, flagPenalties, compareFix } from "../src/lib/diagnostics";
import { signDiagnostic, verifyDiagnostic } from "../src/lib/diagnostic-proof";
import { pillars } from "../src/lib/types";
import { scoreTone } from "../src/lib/score-tone";

beforeEach(() => vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64)));
afterEach(() => vi.unstubAllEnvs());
const image = Buffer.from("fixture-image");
const preview = { width: 200, height: 113, digest: digest("p") };
const context = { videoBrief: "", audience: "", includeVision: true };
function scored(flags: Partial<Record<string, string[]>>, globalFlags: string[] = [], vision = true) {
  const observations = observationSchema.parse({
    summary: "s",
    dimensions: Object.fromEntries(pillars.map((p) => [p, { observation: "seen", strength: "s", weakness: "w", fix: "f", flags: flags[p] || [], suggestions: ["do it"] }])),
    globalFlags,
    suggestion: "Replace the text with a question. Keep the face.",
    keep: ["the face"],
  });
  // Identical Jev numbers for both thumbnails (2/3 → 67 per pillar), as observed live.
  const answers = { answers: Object.fromEntries(pillars.map((p) => [p, { score: 2, confidence: 0.8 }])) };
  return enrichDiagnostic(parseScores(answers, observations, "Petro perdió el control"), image, "Petro perdió el control", context, preview, vision);
}

it("a title-repeating review scores at least 15 points below an otherwise identical one", () => {
  const good = scored({});
  const repeating = scored({ idea: ["text_repeats_title"] });
  expect(good.overall).toBe(67);
  expect(good.penalties).toEqual([]);
  // Caps: idea 67→45, curiosity 67→50 → mean 59, then −12.
  expect(repeating.dimensions.idea.score).toBe(45);
  expect(repeating.dimensions.curiosity.score).toBe(50);
  expect(repeating.meanBeforePenalties).toBe(59);
  expect(repeating.penalties).toEqual([{ flag: "text_repeats_title", points: 12 }]);
  expect(repeating.overall).toBe(47);
  expect(good.overall! - repeating.overall!).toBeGreaterThanOrEqual(15);
});

it("sums fixed penalties for pillar and global flags, ignores zero-cost flags, clamps at 0", () => {
  const s = scored({ clarity: ["tiny_text", "competing_elements", "low_contrast_text"], curiosity: ["spoiler_present"] }, ["logo_or_date_present"]);
  expect(s.penalties!.map((p) => p.flag).sort()).toEqual(["competing_elements", "logo_or_date_present", "spoiler_present", "tiny_text"]);
  expect(s.overall).toBe(67 - 6 - 5 - 10 - 4);
  expect(s.flags).toContainEqual({ pillar: "global", flag: "logo_or_date_present" });
  const worst = scored({ idea: ["text_repeats_title", "depends_on_title"], curiosity: ["spoiler_present"], clarity: ["tiny_text"] }, ["real_person_without_reference", "invented_numbers"]);
  expect(worst.overall).toBe(0);
  expect(flagPenalties.low_contrast_text).toBeUndefined();
});

it("applies no penalties when the image review did not run", () => {
  const s = scored({ idea: ["text_repeats_title"] }, [], false);
  expect(s.penalties).toEqual([]);
  expect(s.overall).toBe(67);
  expect(s.suggestion).toBeUndefined();
});

it("a penalised score still signs and verifies after a JSON round-trip", () => {
  const saved = JSON.parse(JSON.stringify(signDiagnostic(scored({ idea: ["text_repeats_title"] }))));
  expect(() => verifyDiagnostic(saved)).not.toThrow();
  saved.penalties = [];
  expect(() => verifyDiagnostic(saved)).toThrow();
});

it("reports whether a fix improved and keeps the better one as best", () => {
  expect(compareFix("parent", "child", 70, 65)).toEqual({ improved: false, before: 70, after: 65, bestId: "parent" });
  expect(compareFix("parent", "child", 70, 78)).toEqual({ improved: true, before: 70, after: 78, bestId: "child" });
  expect(compareFix("parent", "child", 70, 70)!.bestId).toBe("parent");
  expect(compareFix("parent", "child", null, 70)).toBeUndefined();
});

it("badge tone thresholds: <60 low, 60–79 mid, ≥80 high", () => {
  expect([scoreTone(59), scoreTone(60), scoreTone(79), scoreTone(80), scoreTone(null)]).toEqual(["low", "mid", "mid", "high", "none"]);
});
