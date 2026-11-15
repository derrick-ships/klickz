import { it, expect, beforeEach, vi } from "vitest";
import { signDiagnostic, verifyDiagnostic } from "../src/lib/diagnostic-proof";
import type { Evaluation } from "../src/lib/types";

beforeEach(() => vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64)));

// A score is signed in memory, then saved as JSON and read back before the fix plan.
// Fields that are undefined (e.g. videoEvidence with no YouTube link) vanish on save.
it("a signed score still verifies after a JSON round-trip with undefined fields", () => {
  const score = { source: "jev", version: 3, title: "T", overall: 70, dimensions: {}, videoEvidence: undefined, context: { title: "T", videoBrief: "", audience: "" } } as unknown as Evaluation;
  const saved = JSON.parse(JSON.stringify(signDiagnostic(score)));
  expect("videoEvidence" in saved).toBe(false);
  expect(() => verifyDiagnostic(saved)).not.toThrow();
});
it("still rejects a tampered score", () => {
  const saved = JSON.parse(JSON.stringify(signDiagnostic({ source: "jev", version: 3, title: "T", overall: 70, dimensions: {} } as unknown as Evaluation)));
  saved.overall = 99;
  expect(() => verifyDiagnostic(saved)).toThrow(/Analyze this thumbnail/);
});
