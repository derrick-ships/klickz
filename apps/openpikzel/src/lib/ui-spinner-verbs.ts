// Rotating "working" verbs, Claude Code style, in the language of a thumbnail designer.
// Visual only: the screen-reader live region always says the concrete stage instead.
export type WorkStage = "plan" | "draw" | "score" | "idle";

export const spinnerVerbs: Record<Exclude<WorkStage, "idle">, readonly string[]> = {
  plan: [
    "Storyboarding", "Framing the hook", "Picking the lever", "Thumbnailing", "Kerning",
    "Finding the angle", "Blocking the shot", "Sharpening the promise", "Cutting words",
    "Choosing the face", "Sketching", "Tightening the idea", "Pitching it",
  ],
  draw: [
    "Rendering", "Lighting the set", "Compositing", "Rim-lighting", "Cutting out", "Grading",
    "Upscaling", "Color-grading", "Punching the contrast", "Placing the subject", "Blowing out the sky",
    "Setting the key light", "Masking", "Painting the background",
  ],
  score: [
    "Squinting at it", "Phone-testing", "Grayscale-testing", "Reading it at 200px", "Judging the click",
    "Checking the hook", "Scrolling past it", "Counting the words", "Testing in the feed",
    "Comparing to the feed", "Weighing the emotion",
  ],
};

/** Long waits slip into a calmer register. */
export const idleVerbs: readonly string[] = ["Still cooking", "Letting it render", "Taking its time", "Simmering"];

/** Pik's pose for each stage; two poses alternate within a stage on each verb swap. */
export type PikPose = "paint" | "direct" | "clapper" | "carry" | "inspect" | "cook";
export const pikPoses: Record<WorkStage, readonly PikPose[]> = {
  plan: ["paint", "direct"],
  draw: ["clapper", "carry"],
  score: ["inspect"],
  idle: ["cook"],
};

export const VERB_INTERVAL_MS = 2400;

/** A stable, varied pick: the same stage and tick always give the same verb. */
export function verbFor(stage: WorkStage, tick: number, seed = 0) {
  const list = stage === "idle" ? idleVerbs : spinnerVerbs[stage];
  return list[Math.abs(tick * 7 + seed) % list.length];
}

export function poseFor(stage: WorkStage, tick: number) {
  const poses = pikPoses[stage];
  return poses[Math.abs(tick) % poses.length];
}

/** Honest progress against this account's median generation time: eases to 95%, never past it until the images land. */
export function estimatedProgress(elapsedMs: number, medianMs: number | null | undefined) {
  if (!medianMs || medianMs <= 0) return null;
  const x = Math.min(1, Math.max(0, elapsedMs / medianMs));
  return 0.95 * (1 - Math.pow(1 - x, 3));
}

/** The first ~35% of the expected time is planning the prompt; the rest is drawing. */
export function generationStage(elapsedMs: number, medianMs: number | null | undefined): WorkStage {
  const expected = medianMs && medianMs > 0 ? medianMs : 30_000;
  if (elapsedMs > Math.max(60_000, expected * 1.6)) return "idle";
  return elapsedMs < expected * 0.35 ? "plan" : "draw";
}
