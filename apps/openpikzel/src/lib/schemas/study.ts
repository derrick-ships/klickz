import { z } from "zod";
import type { DesignerRedline } from "../engine/packaging-engine";
import type { ServerFeedCheckResult } from "../engine/server-feed-check";
import type { Evaluation } from "../types";
import type { MindArchetype } from "./audience";

export const productionModeSchema = z.enum(["pre_shoot", "footage_locked"]);
export type ProductionMode = z.infer<typeof productionModeSchema>;

export const diagnosticQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  category: z.enum([
    "click_vote",
    "clarity",
    "believability",
    "relevance",
    "hook_alignment",
    "hesitation",
    "comment_objection",
    "shareability",
  ]),
  prompt: z.string().trim().min(8).max(320),
  locked: z.boolean().optional(),
});
export type DiagnosticQuestion = z.infer<typeof diagnosticQuestionSchema>;

export const createStudySchema = z.object({
  audienceId: z.string().uuid(),
  personaId: z.string().uuid().nullable().optional(),
  styleId: z.string().uuid().nullable().optional(),
  language: z.string().trim().min(2).max(12).optional(),
  titleDraft: z.string().trim().min(3).max(160),
  scriptText: z.string().trim().min(40).max(80000),
  thumbnailPrompt: z.string().trim().max(2400).default(""),
  draftThumbnailPath: z.string().trim().min(3).max(500).nullable().optional(),
  productionMode: productionModeSchema,
  diagnosticQuestions: z.array(diagnosticQuestionSchema).min(6).max(8),
  activeMindIds: z.array(z.string().uuid()).min(12).max(16),
  notifyEmails: z
    .array(z.string().trim().email().max(200))
    .max(3)
    .default([]),
});
export type CreateStudyInput = z.infer<typeof createStudySchema>;

export const packagingConceptSchema = z.object({
  option_key: z.enum(["A", "B", "C"]),
  angle_label: z.string().min(3).max(100),
  title: z.string().min(4).max(120),
  thumbnail_prompt: z.string().min(20).max(1600),
  visual_rationale: z.string().min(10).max(500),
  emotional_lever: z.enum(["MIEDO", "INTRIGA", "DESEO", "FEAR", "INTRIGUE", "DESIRE"]),
  footage_grounding: z.string().max(300).optional(),
});
export type PackagingConcept = z.infer<typeof packagingConceptSchema>;

export const packagingConceptSetSchema = z.object({
  options: z.array(packagingConceptSchema).min(2).max(3),
});

export const mindPass1ResponseSchema = z.object({
  chosen_blind_label: z.enum(["1", "2", "3", "none_keep_scrolling"]),
  click_confidence: z.number().int().min(1).max(10),
  verbatim_click_reason: z.string().min(10).max(500),
  top_hesitation_killer: z.string().min(8).max(400),
  retention_cliff_flag: z.boolean(),
  retention_cliff_note: z.string().max(400).default(""),
  question_answers: z
    .array(
      z.object({
        question_id: z.string().min(1),
        answer: z.string().min(3).max(400),
        score_1_to_10: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(10),
});
export type MindPass1Output = z.infer<typeof mindPass1ResponseSchema>;

export const mindPass2BatchSchema = z.object({
  reactions: z
    .array(
      z.object({
        mind_id: z.string().uuid(),
        comment_skepticism_quote: z.string().min(8).max(400),
        shareability_score: z.number().int().min(1).max(10),
        retention_cliff_flag: z.boolean(),
        retention_cliff_note: z.string().max(300).default(""),
        trust_assessment: z.string().min(5).max(300),
      }),
    )
    .min(1)
    .max(16),
});

export const strategistOutputSchema = z.object({
  buried_angles: z
    .array(
      z.object({
        angle_name: z.string().min(3).max(140),
        why_high_leverage: z.string().min(10).max(500),
        script_quote: z.string().min(8).max(500),
      }),
    )
    .min(2)
    .max(4),
  retention_cliff_diagnosis: z.object({
    severity: z.enum(["low", "medium", "high"]),
    summary: z.string().min(10).max(600),
    exact_drop_point_quote: z.string().max(400).default(""),
  }),
  pre_shoot_plan: z
    .object({
      proposed_angle_thesis: z.string().min(10).max(600),
      rewritten_title: z.string().min(4).max(120),
      rewritten_opening_60s_hook: z.string().min(30).max(2000),
      structural_changes: z.array(z.string().min(5).max(300)).min(2).max(6),
    })
    .nullable(),
  footage_locked_plan: z
    .object({
      cold_open_pull_quote: z.object({
        verbatim_quote: z.string().min(10).max(700),
        editor_cut_instruction: z.string().min(10).max(500),
        why_it_hooks: z.string().min(10).max(400),
      }),
      editor_cut_notes: z.array(z.string().min(5).max(300)).min(2).max(5),
      zero_reshoot_pivots: z
        .array(
          z.object({
            route_name: z.string().min(3).max(100),
            new_title: z.string().min(4).max(120),
            visual_frame_instruction: z.string().min(10).max(500),
            target_emotion: z.string().min(3).max(100),
          }),
        )
        .length(3),
    })
    .nullable(),
});
export type StrategistOutput = z.infer<typeof strategistOutputSchema>;

export type ExecutiveVerdictCode = "SHIP" | "ITERATE" | "RETHINK";

export type ReportOptionSnapshot = {
  optionKey: "A" | "B" | "C";
  isUserDraft: boolean;
  angleLabel: string;
  title: string;
  visualRationale: string;
  emotionalLever: string;
  footageGrounding?: string | null;
  imagePath: string | null;
  jpgPath: string | null;
  klickzScore: Evaluation | null;
  feedCheck: ServerFeedCheckResult | null;
  designerRedline: DesignerRedline | null;
  voteCount: number;
  voteSharePct: number;
};

export type ReportMindVoice = {
  mindId: string;
  name: string;
  avatarSeed: string;
  role: string;
  archetype: MindArchetype;
  ageBracket: string;
  clickBar: number;
  chosenOption: "A" | "B" | "C" | "none_keep_scrolling";
  clickConfidence: number;
  verbatimClickReason: string;
  topHesitationKiller: string;
  questionAnswers: { question_id: string; answer: string; score_1_to_10: number }[];
  commentSkepticismQuote: string | null;
  shareabilityScore: number | null;
  retentionCliffFlag: boolean;
  retentionCliffNote: string | null;
};

export type ReportPayload = {
  version: 1;
  generatedAt: string;
  language: string;
  productionMode: ProductionMode;
  channelTitle: string;
  channelHandle: string | null;
  studyTitleDraft: string;
  totalMindsResponded: number;
  totalSyntheticResponses: number;
  verdict: {
    code: ExecutiveVerdictCode;
    headline: string;
    winningOptionKey: "A" | "B" | "C" | null;
    winningTitle: string | null;
    clickShare: {
      A: { count: number; pct: number };
      B: { count: number; pct: number };
      C: { count: number; pct: number };
      none_keep_scrolling: { count: number; pct: number };
    };
    retentionCliff: StrategistOutput["retention_cliff_diagnosis"];
    topHesitationKillers: { killer: string; count: number }[];
  };
  angleDiagnosis: {
    buriedAngles: StrategistOutput["buried_angles"];
    preShootPlan: StrategistOutput["pre_shoot_plan"];
    footageLockedPlan: StrategistOutput["footage_locked_plan"];
  };
  packagingMatrix: ReportOptionSnapshot[];
  diagnosticQuestions: DiagnosticQuestion[];
  voiceOfMinds: ReportMindVoice[];
  warnings: string[];
};

export function extractOpening60s(scriptText: string): string {
  const words = scriptText.trim().split(/\s+/).filter(Boolean);
  // ~165 words ≈ 60 seconds of spoken YouTube delivery
  return words.slice(0, 170).join(" ").slice(0, 3800);
}
