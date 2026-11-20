import { pillars, type Evaluation, type Pillar } from "./types";
import { thumbnailRubric } from "./instructions";

// Old scores may lack advice which newer scores fill during analysis.
export function pillarAdvice(score: Evaluation, pillar: Pillar) {
  const dimension = score.dimensions[pillar];
  const fallback = dimension.score !== null && dimension.score < 70 && (!dimension.weakness.trim() || !dimension.fix.trim());
  return {
    weakness: dimension.weakness.trim() || (fallback ? "A numeric rubric alone does not identify a specific visible flaw." : ""),
    fix: dimension.fix.trim() || (fallback ? thumbnailRubric[pillar].instructions + " Aim for: " + thumbnailRubric[pillar].criteria[3] + ". Preserve the truthful video promise." : ""),
    generalAdvice: !!dimension.generalAdvice || fallback,
  };
}

// One copyable editing prompt built from a finished analysis: the weakest pillars'
// concrete fixes first, so applying it targets what holds the score back. Shared by
// the app's "Copy improvement prompt", analyze_thumbnail and get_fix_prompt.
export function fixPrompt(score: Evaluation) {
  const ordered = [...pillars]
    .filter((p) => score.dimensions[p].score !== null && pillarAdvice(score, p).fix)
    .sort((a, b) => (score.dimensions[a].score ?? 100) - (score.dimensions[b].score ?? 100));
  if (!ordered.length) return null;
  const steps = ordered.map((p, i) => `${i + 1}. ${p} (${score.dimensions[p].score}/100): ${pillarAdvice(score, p).generalAdvice ? "General advice: " : ""}${pillarAdvice(score, p).fix}`).join("\n");
  return (
    `Edit the attached original thumbnail${score.title ? ` for the video titled "${score.title}"` : ""}. ` +
    "Keep the same person, identity, exact on-image wording and truthful video promise unless a step below says otherwise. Preserve what already works. " +
    "Apply these improvements, weakest pillar first:\n" +
    steps +
    "\nKeep one clear focal point, readable short text, and strong contrast at phone-feed size. The image text must not repeat the title. Return the edited thumbnail as a new version. Do not claim guaranteed clicks or invent evidence."
  );
}
