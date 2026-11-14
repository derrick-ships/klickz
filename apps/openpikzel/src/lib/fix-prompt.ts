import { pillars, type Evaluation } from "./types";

// One copyable editing prompt built from a finished analysis: the weakest pillars'
// concrete fixes first, so applying it targets what holds the score back. Shared by
// the app's "Copy improvement prompt", analyze_thumbnail and get_fix_prompt.
export function fixPrompt(score: Evaluation) {
  const ordered = [...pillars]
    .filter((p) => score.dimensions[p].score !== null && score.dimensions[p].fix.trim())
    .sort((a, b) => (score.dimensions[a].score ?? 100) - (score.dimensions[b].score ?? 100));
  if (!ordered.length) return null;
  const steps = ordered.map((p, i) => `${i + 1}. ${p} (${score.dimensions[p].score}/100): ${score.dimensions[p].fix}`).join("\n");
  return (
    `Edit the attached original thumbnail${score.title ? ` for the video titled "${score.title}"` : ""}. ` +
    "Keep the same person, identity, exact on-image wording and truthful video promise unless a step below says otherwise. Preserve what already works. " +
    "Apply these improvements, weakest pillar first:\n" +
    steps +
    "\nKeep one clear focal point, readable short text, and strong contrast at phone-feed size. The image text must not repeat the title. Return the edited thumbnail as a new version. Do not claim guaranteed clicks or invent evidence."
  );
}
