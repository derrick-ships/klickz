import { describe, it, expect, vi, afterEach } from "vitest";
import { defaultSettings, pillars, type Evaluation } from "../src/lib/types";
import { parseScores } from "../src/lib/validation";
import {
  actualPreview,
  compileFixPlan,
  enrichDiagnostic,
  digest,
  semanticDigest,
  validateFixPlan,
} from "../src/lib/diagnostics";
import { signDiagnostic, verifyDiagnostic } from "../src/lib/diagnostic-proof";
import sharp from "sharp";
const image = Buffer.from("licensed-fixture-stand-in");
const context = {
  videoBrief: "The creator tests a real solar cooker outdoors.",
  audience: "Home cooks",
  includeVision: true,
};
const preview = { width: 200, height: 113, digest: digest("preview") };
function score() {
  const base = parseScores({
    answers: Object.fromEntries(
      pillars.map((p) => [p, { score: 1.5, confidence: 0.7 }]),
    ),
  });
  for (const p of pillars)
    base.dimensions[p] = {
      ...base.dimensions[p],
      observation: "Small text competes with the visible cooker.",
      strength: "One main subject.",
      weakness: "Text competes with the subject.",
      fix: "Simplify the competing text.",
    };
  return enrichDiagnostic(
    base,
    image,
    "I cooked with the sun",
    context,
    preview,
    true,
  );
}
afterEach(() => vi.unstubAllEnvs());
describe("original evidence-based diagnostic and fix compiler", () => {
  it("keeps observed zero distinct from unassessable and computes no partial average", () => {
    const zero = parseScores({
      answers: Object.fromEntries(
        pillars.map((p) => [p, { score: 0, confidence: 1 }]),
      ),
    });
    expect(zero.overall).toBe(0);
    const partial = enrichDiagnostic(
      zero,
      image,
      "",
      { ...context, videoBrief: "" },
      preview,
      true,
    );
    // Approved 16 Nov: no title still gets a full score (Idea/Curiosity judged from the image alone).
    expect(partial.overall).toBe(0);
    expect(partial.dimensions.clarity.score).toBe(0);
    expect(partial.dimensions.idea.score).toBe(0);
    const missing = enrichDiagnostic(parseScores({ answers: { virality: { score: 1, confidence: 1 } } }), image, "", { ...context, videoBrief: "" }, preview, true);
    expect(missing.overall).toBeNull();
    expect(missing.dimensions.idea.missingReason).toBeTruthy();
    expect(missing.fixBlocked).toBe(true);
  });
  it("creates an actual small derivative without stretching the source", async () => {
    const b = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: "#dc1728" },
    })
      .png()
      .toBuffer();
    const m = await sharp(await actualPreview(b)).metadata();
    expect([m.width, m.height]).toEqual([200, 113]);
  });
  it("binds cache identity to source, actual preview, context, vision choice and rubric", () => {
    const a = score();
    const changed = enrichDiagnostic(
      a,
      image,
      "Different title",
      context,
      preview,
      true,
    );
    expect(changed.inputDigest).not.toBe(a.inputDigest);
    expect(
      enrichDiagnostic(
        a,
        image,
        a.title,
        { ...context, videoBrief: "Different promise" },
        preview,
        true,
      ).inputDigest,
    ).not.toBe(a.inputDigest);
    expect(
      enrichDiagnostic(
        a,
        image,
        a.title,
        context,
        { ...preview, digest: digest("other") },
        true,
      ).inputDigest,
    ).not.toBe(a.inputDigest);
  });
  it("cannot turn rubric-only guesses into actionable evidence", () => {
    const a = enrichDiagnostic(
      score(),
      image,
      "I cooked with the sun",
      context,
      preview,
      false,
    );
    expect(a.issues).toHaveLength(0);
    expect(a.evidence).toHaveLength(0);
    expect(a.fixBlocked).toBe(true);
  });
  it("treats a factual contradiction as a gate independent of the numeric score", () => {
    const a = enrichDiagnostic(
      score(),
      image,
      "I cooked with the sun",
      context,
      preview,
      true,
      true,
    );
    expect(a.overall).toBe(50);
    expect(a.fixBlocked).toBe(true);
    expect(
      compileFixPlan(a, "source", digest(image), defaultSettings, {
        exactText: [],
        requiredObjects: [],
        forbiddenChanges: [],
      }).kind,
    ).toBe("blocked");
  });
  it("compiles only supported issues, preserves explicit constraints and refuses multi-image fixes", () => {
    const a = score(),
      preserve = {
        exactText: ["SOLAR COOKER"],
        requiredObjects: ["the original cooker"],
        forbiddenChanges: ["No invented cooking results"],
      };
    const result = compileFixPlan(
      a,
      "source",
      digest(image),
      defaultSettings,
      preserve,
      ["clarity"],
    );
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.plan.operations).toHaveLength(1);
    expect(result.plan.preserve).toEqual(preserve);
    expect(() =>
      compileFixPlan(
        a,
        "source",
        digest(image),
        { ...defaultSettings, batch: 4 },
        preserve,
      ),
    ).toThrow();
    expect(() =>
      compileFixPlan(a, "source", digest(image), defaultSettings, preserve, [
        "invented",
      ]),
    ).toThrow();
    expect(
      compileFixPlan(a, "source", digest(image), defaultSettings, preserve, [])
        .kind,
    ).toBe("noop");
  });
  it("blocks stale source, altered settings, expired approval or plan tampering before dispatch", () => {
    const a = score(),
      r = compileFixPlan(a, "source", digest(image), defaultSettings, {
        exactText: [],
        requiredObjects: [],
        forbiddenChanges: [],
      });
    if (r.kind !== "ready") throw new Error();
    expect(() =>
      validateFixPlan(r.plan, "source", image, a, defaultSettings),
    ).not.toThrow();
    expect(() =>
      validateFixPlan(
        r.plan,
        "source",
        Buffer.from("changed"),
        a,
        defaultSettings,
      ),
    ).toThrow();
    expect(() =>
      validateFixPlan(r.plan, "source", image, a, {
        ...defaultSettings,
        quality: "max",
      }),
    ).toThrow();
    expect(() =>
      validateFixPlan(
        { ...r.plan, expiresAt: 0 },
        "source",
        image,
        a,
        defaultSettings,
      ),
    ).toThrow();
    expect(() =>
      validateFixPlan(
        { ...r.plan, title: "Forged" },
        "source",
        image,
        a,
        defaultSettings,
      ),
    ).toThrow();
  });
  it("invalidates an approved plan after same-input reanalysis changes evidence or eligibility", () => {
    const a = score(),
      r = compileFixPlan(a, "source", digest(image), defaultSettings, {
        exactText: [],
        requiredObjects: [],
        forbiddenChanges: [],
      });
    if (r.kind !== "ready") throw new Error();
    const newer = {
      ...a,
      fixBlocked: true,
      warnings: ["New contradiction found"],
    };
    expect(newer.inputDigest).toBe(a.inputDigest);
    expect(() =>
      validateFixPlan(r.plan, "source", image, newer, defaultSettings),
    ).toThrow();
    const other = { ...a, created_at: new Date(Date.now() + 1).toISOString() };
    expect(() =>
      validateFixPlan(r.plan, "source", image, other, defaultSettings),
    ).toThrow();
  });
  it("requires server-authenticated diagnostics rather than trusting a client-edited score row", () => {
    vi.stubEnv("STUDIO_ENCRYPTION_KEY", "c".repeat(64));
    const signed = signDiagnostic(score());
    expect(() => verifyDiagnostic(signed)).not.toThrow();
    expect(() => verifyDiagnostic({ ...signed, title: "Tampered" })).toThrow();
    expect(() => verifyDiagnostic(score())).toThrow();
  });
});
