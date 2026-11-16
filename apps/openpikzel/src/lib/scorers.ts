// Who gives the five pillar numbers, in the order they are tried. Browser-safe (no server imports):
// the studio uses it to decide whether a score can run, the server to run the fallbacks.
//   jev       TypeSafe Jev decision model (default)
//   openai    OpenAI Decisions API, gpt-6-luna (OpenAI's own decision model)
//   anthropic Claude with the same rubric, as a structured reply
//   google    Gemini with the same rubric, as a structured reply
import type { VisionProvider } from "./vision-provider";

export type ScorerId = "jev" | VisionProvider;
export const visionProviders: VisionProvider[] = ["anthropic", "openai", "google"];

export const scorerLabel = (scorer: ScorerId) =>
  scorer === "jev" ? "Jev" : scorer === "anthropic" ? "Claude" : scorer === "openai" ? "OpenAI" : "Google";
export const scorerProviderName = (scorer: ScorerId) =>
  scorer === "jev" ? "Jev" : scorer === "anthropic" ? "Anthropic API" : scorer === "openai" ? "OpenAI Decisions API" : "Google API";

/**
 * The chosen scorer first, then every other connected one. Decision models (Jev, OpenAI Decisions) come before
 * language models answering the rubric. With scorer "jev" (default): Jev, OpenAI Decisions, then the reviewer
 * the user picked, then the other connected keys. With scorer "model": the reviewer first, then the rest in the
 * same order. Only connected providers appear; `max` caps the attempts so a request stays within its budget.
 */
export function scorerOrder(
  preference: string | undefined,
  reviewer: VisionProvider | null | undefined,
  connected: Partial<Record<ScorerId, boolean>>,
  max = 3,
): ScorerId[] {
  const base: ScorerId[] = ["jev", "openai", ...(reviewer && reviewer !== "openai" ? [reviewer] : []), "anthropic", "google"];
  const ordered = preference === "model" && reviewer ? [reviewer, ...base] : base;
  return ordered.filter((s, i) => ordered.indexOf(s) === i && !!connected[s]).slice(0, Math.max(0, max));
}

/** True when at least one connected key can score a thumbnail. */
export const canScore = (connected: Partial<Record<ScorerId, boolean>> | null | undefined) =>
  !!connected && (!!connected.jev || visionProviders.some((p) => !!connected[p]));
