import { pillars, type Pillar } from "../../src/lib/types";
import { jevFlagQuestions, flagQuestionId, jevScoreCriteria } from "../../src/lib/jev-questions";

/**
 * A Jev System One reply in the documented shape (docs.typesafe.ai/primitives/score and /noul):
 * Score answers carry type, score (0..levels-1 expected value), confidence, legend and probabilities;
 * Noul answers carry only type and noul. The reply also names the model and usage.
 */
export function jevReply(opts: { scores?: Partial<Record<Pillar, number | null>>; confidence?: number; nouls?: Record<string, number>; model?: string } = {}) {
  const answers: Record<string, unknown> = {};
  for (const p of pillars) {
    const score = opts.scores?.[p] === undefined ? 2 : opts.scores[p];
    if (score === null) continue;
    const levels = jevScoreCriteria[p].length;
    const low = Math.floor(score), high = Math.min(levels - 1, low + 1), frac = score - low;
    const probabilities = Object.fromEntries(Array.from({ length: levels }, (_, i) => [String(i), i === low ? 1 - frac : i === high && high !== low ? frac : 0]));
    answers[p] = { type: "score", score, confidence: opts.confidence ?? 0.7, legend: Object.fromEntries(jevScoreCriteria[p].map((l, i) => [String(i), l.what])), probabilities };
  }
  for (const q of jevFlagQuestions) answers[flagQuestionId(q.flag)] = { type: "noul", noul: opts.nouls?.[q.flag] ?? 0.05 };
  answers.screen_text_is_instruction = { type: "noul", noul: opts.nouls?.screen_text_is_instruction ?? 0.02 };
  return { model: opts.model ?? "jev-1.14.0", answers, usage: { input_tokens: 2400, output_tokens: 120 } };
}
