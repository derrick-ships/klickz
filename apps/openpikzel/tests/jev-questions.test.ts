import { describe, expect, it } from "vitest";
import {
  flagQuestionId,
  flagThreshold,
  jevFlagQuestions,
  jevScoreCriteria,
  readJevFlags,
} from "../src/lib/jev-questions";
import { globalFlagVocabulary, pillarFlagVocabulary, pillars } from "../src/lib/types";

const everyFlag = [
  ...pillars.flatMap((p) => pillarFlagVocabulary[p]),
  ...globalFlagVocabulary,
];

describe("Jev questions follow the TypeSafe contract", () => {
  it("asks one Noul per review flag with concrete true/false descriptions", () => {
    expect(jevFlagQuestions).toHaveLength(everyFlag.length);
    expect(new Set(jevFlagQuestions.map((q) => q.flag)).size).toBe(everyFlag.length);
    for (const question of jevFlagQuestions) {
      expect(question.question.type).toBe("noul");
      // Levels and criteria must describe situations, not degrees, and both ends must exist.
      expect(question.question.criteria.true.length).toBeGreaterThan(10);
      expect(question.question.criteria.false.length).toBeGreaterThan(10);
      expect(question.question.criteria.true).not.toBe(question.question.criteria.false);
    }
  });

  it("gives every pillar Score concrete levels with examples, ordered worst to best", () => {
    for (const p of pillars) {
      const levels = jevScoreCriteria[p];
      expect(levels).toHaveLength(4);
      for (const level of levels) {
        expect(level.what.length).toBeGreaterThan(8);
        expect(level.examples.length).toBeGreaterThanOrEqual(1);
        // "Moderately severe" teaches the model nothing; situations do.
        expect(level.what).not.toMatch(/^(very|somewhat|moderately|slightly|extremely)\b/i);
      }
      expect(new Set(levels.map((l) => l.what)).size).toBe(4);
    }
  });

  it("keeps a stable question id per flag", () => {
    expect(flagQuestionId("text_repeats_title")).toBe("flag_text_repeats_title");
    expect(new Set(jevFlagQuestions.map((q) => flagQuestionId(q.flag))).size).toBe(everyFlag.length);
  });
});

describe("readJevFlags", () => {
  const answers = (probabilities: Record<string, number>) =>
    Object.fromEntries(Object.entries(probabilities).map(([flag, noul]) => [flagQuestionId(flag as never), { type: "noul", noul }]));

  it("applies a flag only at or above the threshold and routes globals separately", () => {
    const read = readJevFlags(
      answers({ text_repeats_title: 0.92, tiny_text: 0.4, logo_or_date_present: flagThreshold, real_person_without_reference: 0.51 }),
    );
    expect(read.pillars.idea).toEqual(["text_repeats_title"]);
    expect(read.pillars.clarity).toBeUndefined();
    expect(read.globalFlags).toEqual(expect.arrayContaining(["logo_or_date_present", "real_person_without_reference"]));
    expect(read.probabilities.tiny_text).toBeCloseTo(0.4);
  });

  it("reports unanswered questions instead of inventing flags", () => {
    const read = readJevFlags({ flag_text_repeats_title: { noul: 0.8 } });
    expect(read.pillars.idea).toEqual(["text_repeats_title"]);
    expect(read.unanswered).toHaveLength(everyFlag.length - 1);
    expect(read.unanswered).not.toContain("text_repeats_title");
  });

  it("survives a malformed payload without throwing", () => {
    expect(readJevFlags(null).unanswered).toHaveLength(everyFlag.length);
    expect(readJevFlags({ flag_tiny_text: { noul: "yes" } }).unanswered).toContain("tiny_text");
  });
});
