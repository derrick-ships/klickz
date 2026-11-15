import type { Evaluation } from "@/lib/types";

/** The score on the thumbnail itself, top-left, like the feed shows it: a ring and the number. */
export function ScoreBadge({ score, pending = false }: { score?: Evaluation | null; pending?: boolean }) {
  const value = score?.overall ?? null;
  if (value === null && !pending && !score) return null;
  const tone = value === null ? "none" : value < 50 ? "low" : value < 70 ? "mid" : "high";
  const r = 9, c = 2 * Math.PI * r;
  const label = pending ? "Scoring" : value === null ? "Partial score" : `Score ${value} out of 100`;
  return (
    <span className="score-badge" data-tone={pending ? "pending" : tone} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r={r} className="score-badge-track" />
        <circle cx="12" cy="12" r={r} className="score-badge-arc" strokeDasharray={c} strokeDashoffset={pending ? c * 0.75 : c * (1 - Math.max(0, Math.min(100, value ?? 0)) / 100)} />
      </svg>
      <span>{pending ? "…" : value === null ? "Partial" : value}</span>
    </span>
  );
}
