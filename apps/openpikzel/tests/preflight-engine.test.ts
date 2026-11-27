import { describe, expect, it } from "vitest";
import { estimateStudyCost } from "../src/lib/study-cost";
import {
  blindOrderForMind,
  mapBlindChoiceToCanonical,
} from "../src/lib/triangulation/calibration-prompts";
import { computeDeterministicVerdict } from "../src/lib/triangulation/compile-report";
import { renderReportMarkdown } from "../src/lib/reports/render-markdown";
import { extractOpening60s, type ReportPayload } from "../src/lib/schemas/study";

describe("Pre-Flight Packaging Engine Core", () => {
  it("estimates synthetic responses and image renders accurately with/without draft", () => {
    const withDraft = estimateStudyCost({
      mindsCount: 16,
      questionsCount: 8,
      hasDraftThumbnail: true,
      scriptChars: 6000,
    });
    const withoutDraft = estimateStudyCost({
      mindsCount: 16,
      questionsCount: 8,
      hasDraftThumbnail: false,
      scriptChars: 6000,
    });
    expect(withDraft.syntheticResponses).toBe(128);
    expect(withDraft.imageRenders).toBe(2);
    expect(withoutDraft.imageRenders).toBe(3);
    expect(withoutDraft.estimatedUsdMax).toBeGreaterThan(withDraft.estimatedUsdMin);
  });

  it("permutes blind option order and maps votes back deterministically", () => {
    const order = blindOrderForMind(2, 0); // ["B", "A", "C"]
    expect(order).toEqual(["B", "A", "C"]);
    expect(mapBlindChoiceToCanonical("1", order)).toBe("B");
    expect(mapBlindChoiceToCanonical("2", order)).toBe("A");
    expect(mapBlindChoiceToCanonical("none_keep_scrolling", order)).toBe(
      "none_keep_scrolling",
    );
  });

  it("assigns RETHINK verdict when >= 45% of Minds keep scrolling", () => {
    const verdict = computeDeterministicVerdict({
      language: "en",
      options: [
        { optionKey: "A", title: "Title A" },
        { optionKey: "B", title: "Title B" },
        { optionKey: "C", title: "Title C" },
      ],
      votes: [
        "none_keep_scrolling",
        "none_keep_scrolling",
        "none_keep_scrolling",
        "none_keep_scrolling",
        "none_keep_scrolling",
        "none_keep_scrolling",
        "none_keep_scrolling",
        "none_keep_scrolling",
        "A",
        "A",
        "B",
        "C",
      ],
      retentionSeverity: "medium",
    });
    expect(verdict.code).toBe("RETHINK");
    expect(verdict.winningOptionKey).toBeNull();
    expect(verdict.clickShare.none_keep_scrolling.pct).toBe(67);
  });

  it("assigns SHIP verdict when winning option >= 35%, skip < 35%, and retention is not high", () => {
    const verdict = computeDeterministicVerdict({
      language: "es",
      options: [
        { optionKey: "A", title: "Título A" },
        { optionKey: "B", title: "Título B" },
        { optionKey: "C", title: "Título C" },
      ],
      votes: ["B", "B", "B", "B", "B", "B", "B", "A", "A", "C", "none_keep_scrolling", "none_keep_scrolling"],
      retentionSeverity: "low",
    });
    expect(verdict.code).toBe("SHIP");
    expect(verdict.winningOptionKey).toBe("B");
    expect(verdict.headline).toContain("LISTO PARA PUBLICAR");
  });

  it("extracts opening 60s and renders clean Markdown brief", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    expect(extractOpening60s(words).split(" ").length).toBe(170);

    const mockReport: ReportPayload = {
      version: 1,
      generatedAt: "2026-11-27T11:00:00.000Z",
      language: "en",
      productionMode: "footage_locked",
      channelTitle: "Test Channel",
      channelHandle: "@test",
      studyTitleDraft: "Draft Title",
      totalMindsResponded: 16,
      totalSyntheticResponses: 128,
      verdict: {
        code: "ITERATE",
        headline: "ITERATE BEFORE SHIPPING",
        winningOptionKey: "B",
        winningTitle: "Better Title B",
        clickShare: {
          A: { count: 3, pct: 19 },
          B: { count: 7, pct: 44 },
          C: { count: 2, pct: 13 },
          none_keep_scrolling: { count: 4, pct: 25 },
        },
        retentionCliff: {
          severity: "medium",
          summary: "Intro takes 35s to mention stakes.",
          exact_drop_point_quote: "Hey guys welcome back",
        },
        topHesitationKillers: [{ killer: "Too vague", count: 4 }],
      },
      angleDiagnosis: {
        buriedAngles: [
          {
            angle_name: "Hidden $40k mistake",
            why_high_leverage: "Concrete loss triggers instant intrigue.",
            script_quote: "We actually lost $40k in week two.",
          },
        ],
        preShootPlan: null,
        footageLockedPlan: {
          cold_open_pull_quote: {
            verbatim_quote: "We actually lost $40k in week two.",
            editor_cut_instruction: "Move clip from 04:12 to 00:00.",
            why_it_hooks: "Immediate concrete stakes.",
          },
          editor_cut_notes: ["Cut 20s channel intro"],
          zero_reshoot_pivots: [
            { route_name: "R1", new_title: "T1", visual_frame_instruction: "Frame 1", target_emotion: "Fear" },
            { route_name: "R2", new_title: "T2", visual_frame_instruction: "Frame 2", target_emotion: "Intrigue" },
            { route_name: "R3", new_title: "T3", visual_frame_instruction: "Frame 3", target_emotion: "Desire" },
          ],
        },
      },
      packagingMatrix: [],
      diagnosticQuestions: [],
      voiceOfMinds: [],
      warnings: [],
    };
    const md = renderReportMarkdown(mockReport, "https://openpikzels.com/reports/abc12345");
    expect(md).toContain("Zero-Reshoot Cold-Open Pull Quote");
    expect(md).toContain("We actually lost $40k in week two.");
  });
});
