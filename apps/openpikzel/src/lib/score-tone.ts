/** Shared score badge tone: <60 low, 60–79 mid, ≥80 high. null/undefined/NaN → "none". */
export type ScoreTone = "low" | "mid" | "high" | "none";
export function scoreTone(n: number | null | undefined): ScoreTone {
  if (typeof n !== "number" || !Number.isFinite(n)) return "none";
  const v = Math.round(n);
  return v >= 80 ? "high" : v >= 60 ? "mid" : "low";
}
