import "server-only";
import { callStructuredJson } from "../llm-router";
import {
  strategistOutputSchema,
  type ProductionMode,
  type StrategistOutput,
} from "../schemas/study";

export async function runEditorialStrategist(params: {
  language: string;
  productionMode: ProductionMode;
  scriptText: string;
  titleDraft: string;
  personaTone: string;
  channelTitle: string;
  outlierPatterns: unknown;
  packagingSummary: unknown;
  mindReactionsSummary: unknown;
}): Promise<StrategistOutput> {
  const modeRule =
    params.productionMode === "pre_shoot"
      ? `MODE IS "pre_shoot":
- You MUST populate "pre_shoot_plan" with a sharper angle thesis, rewritten title, a verbatim rewritten 60-second spoken hook (~140-170 words ready to read on camera), and 2-6 structural pacing changes.
- You MUST set "footage_locked_plan" to null.`
      : `MODE IS "footage_locked" (ZERO RESHOOTS ALLOWED):
- You MUST set "pre_shoot_plan" to null.
- You MUST populate "footage_locked_plan":
  1. "cold_open_pull_quote": pick ONE exact verbatim high-stakes quote that ALREADY EXISTS later inside the supplied script_text so the editor can cut it straight to 0:00 as a cold open, plus concrete editor cut instructions.
  2. "editor_cut_notes": 2-5 concrete zero-reshoot edit cuts (what to trim in the intro, B-roll/text callouts).
  3. "zero_reshoot_pivots": EXACTLY 3 distinct zero-reshoot packaging pivots (new title + visual frame instruction grounded strictly in filmed material or saved creator persona).`;

  const { data } = await callStructuredJson({
    role: "strategist",
    schema: strategistOutputSchema,
    maxTokens: 4500,
    timeoutMs: 120_000,
    system: `You are an elite YouTube Editorial Angle Strategist and Executive Producer.
Your job: audit the ENTIRE script against the 16 synthetic Mind reactions (Pass 1 votes, hesitation killers, Pass 2 comment-section skepticism) and the channel's historical outlier patterns.
1. Hunt for BURIED HIGH-LEVERAGE ANGLES hidden in the middle or end of the script that outperform the creator's draft packaging. Always quote the actual script text as proof.
2. Diagnose the real retention cliff in the opening 60 seconds with zero sugarcoating.
3. Respect the creator's voice: ${params.personaTone || "Direct, sharp, credible."}
4. ${modeRule}
5. LANGUAGE RULE: Write EVERY field in natural "${params.language}".`,
    userPrompt: JSON.stringify({
      channelTitle: params.channelTitle,
      productionMode: params.productionMode,
      creatorDraftTitle: params.titleDraft,
      channelOutlierPatterns: params.outlierPatterns,
      legAPackagingSummary: params.packagingSummary,
      legBMindsSummary: params.mindReactionsSummary,
      fullScript: params.scriptText.slice(0, 48000),
      requiredJsonShape: {
        buried_angles: [
          {
            angle_name: "string",
            why_high_leverage: "string",
            script_quote: "verbatim quote from fullScript",
          },
        ],
        retention_cliff_diagnosis: {
          severity: "low | medium | high",
          summary: "string",
          exact_drop_point_quote: "verbatim quote from opening",
        },
        pre_shoot_plan:
          params.productionMode === "pre_shoot"
            ? {
                proposed_angle_thesis: "string",
                rewritten_title: "string",
                rewritten_opening_60s_hook: "string (~150 words)",
                structural_changes: ["string"],
              }
            : null,
        footage_locked_plan:
          params.productionMode === "footage_locked"
            ? {
                cold_open_pull_quote: {
                  verbatim_quote: "verbatim quote found in fullScript",
                  editor_cut_instruction: "string",
                  why_it_hooks: "string",
                },
                editor_cut_notes: ["string"],
                zero_reshoot_pivots: [
                  {
                    route_name: "string",
                    new_title: "string",
                    visual_frame_instruction: "string",
                    target_emotion: "string",
                  },
                ],
              }
            : null,
      },
    }),
  });

  // Enforce strict branch exclusivity in code
  return {
    ...data,
    retention_cliff_diagnosis: {
      ...data.retention_cliff_diagnosis,
      exact_drop_point_quote:
        data.retention_cliff_diagnosis.exact_drop_point_quote ?? "",
    },
    pre_shoot_plan:
      params.productionMode === "pre_shoot" ? data.pre_shoot_plan : null,
    footage_locked_plan:
      params.productionMode === "footage_locked"
        ? data.footage_locked_plan
        : null,
  };
}
