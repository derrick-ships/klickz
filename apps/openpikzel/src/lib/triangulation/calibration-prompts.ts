import type { PersistedMind } from "../schemas/audience";
import type { DiagnosticQuestion } from "../schemas/study";

export type OptionKey = "A" | "B" | "C";

const PERMUTATIONS: [OptionKey, OptionKey, OptionKey][] = [
  ["A", "B", "C"],
  ["A", "C", "B"],
  ["B", "A", "C"],
  ["B", "C", "A"],
  ["C", "A", "B"],
  ["C", "B", "A"],
];

/**
 * Deterministic, position-unbiased option ordering per Mind index so Option A
 * never gets artificial first-slot bias.
 */
export function blindOrderForMind(
  mindIndex: number,
  seedOffset = 0,
): [OptionKey, OptionKey, OptionKey] {
  return PERMUTATIONS[(mindIndex + seedOffset) % PERMUTATIONS.length];
}

export function mapBlindChoiceToCanonical(
  blindChoice: "1" | "2" | "3" | "none_keep_scrolling",
  order: readonly OptionKey[],
): OptionKey | "none_keep_scrolling" {
  if (blindChoice === "none_keep_scrolling") return "none_keep_scrolling";
  const idx = Number(blindChoice) - 1;
  return order[idx] ?? "none_keep_scrolling";
}

export function buildMindPass1SystemPrompt(
  mind: PersistedMind,
  language: string,
): string {
  return `You are roleplaying ONE specific YouTube viewer scrolling their home feed on their phone:
- Name: ${mind.name} (${mind.age_bracket})
- Role / Life Context: ${mind.role}
- Viewer Archetype: ${mind.archetype}
- Personal Click Threshold: ${mind.click_bar}/10 (higher = much harder to stop scrolling)
- What you know / care about: ${mind.knowledge_items.join(" | ")}
- How you evaluate videos: ${mind.thinking_patterns.join(" | ")}
- Instant skepticism / turn-off triggers: ${mind.skepticism_triggers.join(" | ")}
- Your natural voice: "${mind.sample_voice_quote}"

ANTI-FLATTERY CALIBRATION (MANDATORY — NEVER BREAK THESE RULES):
1. On a real YouTube feed, viewers scroll past 85-95% of videos. Do NOT be polite, encouraging, or flattering.
2. You MUST choose "none_keep_scrolling" if NO option genuinely clears your personal click threshold (${mind.click_bar}/10) or if your skepticism triggers fire.
3. NEVER use vague AI praise ("great concept", "eye-catching", "interesting topic", "well done"). Cite concrete visible details from the attached thumbnails, exact title words, or specific lines in the opening 60s script.
4. Score calibration (1-10): 5 = average scrollable video you skip; 7 = genuinely makes you pause; 9-10 = rare must-click outlier.
5. LANGUAGE RULE: Respond in natural "${language}" matching your real voice.`;
}

export function buildMindPass1UserPayload(params: {
  orderedOptions: { label: "1" | "2" | "3"; title: string }[];
  opening60s: string;
  questions: DiagnosticQuestion[];
}) {
  return JSON.stringify({
    instruction:
      "The 3 attached images correspond in exact order to Option 1, Option 2, and Option 3 below. Evaluate them cold, then read the opening 60 seconds script excerpt and answer every diagnostic question honestly as your persona.",
    optionsShown: params.orderedOptions,
    opening60SecondsScript: params.opening60s,
    diagnosticQuestions: params.questions.map((q) => ({
      question_id: q.id,
      prompt: q.prompt,
    })),
    requiredJsonShape: {
      chosen_blind_label: "1 | 2 | 3 | none_keep_scrolling",
      click_confidence: "integer 1-10",
      verbatim_click_reason: "blunt 1-3 sentence reaction citing specifics",
      top_hesitation_killer: "the single biggest reason you hesitate or scroll past",
      retention_cliff_flag: "boolean — true if opening 60s loses you or breaks thumbnail promise",
      retention_cliff_note: "specific line or moment where interest drops (empty string if false)",
      question_answers: [
        {
          question_id: "must match each question_id above",
          answer: "specific honest answer",
          score_1_to_10: 5,
        },
      ],
    },
  });
}
