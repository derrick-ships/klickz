export type ScanPhase = "running" | "succeeded" | "failed";
// A visual pacing counter, never a measurement of provider progress.
export function scanCounter(elapsedMs: number, phase: ScanPhase, reduced = false): number {
  if (phase === "succeeded") return 100;
  if (reduced) return 0;
  return Math.min(95, Math.max(0, Math.floor(95 * (1 - Math.exp(-Math.max(0, elapsedMs) / 18000)))));
}
export function recomposePrompt(format: "long" | "short") {
  return "Create a new " + (format === "short" ? "vertical 9:16" : "horizontal 16:9") +
    " composition of the attached thumbnail. Rearrange its existing visual elements to work naturally in this aspect ratio: reposition and scale the main subject, headline and supporting objects into a clear hierarchy. Preserve the same person's identity, recognizable subject, exact readable headline wording, factual message, brand colors and visual identity. Keep text inside generous safe margins and legible at feed size. Do not merely crop, stretch, add blurred padding or fill the background around the old composition. Do not invent new claims, people, logos or factual objects. Return one finished image. The original is preserved separately.";
}
