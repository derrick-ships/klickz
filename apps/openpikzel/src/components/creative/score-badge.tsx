import type { Evaluation } from "@/lib/types";
import { scoreTone } from "@/lib/score-tone";

/**
 * The score on the thumbnail itself, top-left, like the feed shows it: a small ring and the number.
 * With `onOpen` (and a landed score) it is a button that opens the full score. It must then sit beside, never inside,
 * another button: wrap the thumbnail button and the badge in one positioned element.
 */
export function ScoreBadge({ score, pending = false, onOpen, label }: { score?: Evaluation | null; pending?: boolean; onOpen?: () => void; label?: string }) {
  const value = score?.overall ?? null;
  if (value === null && !pending && !score) return null;
  const tone = pending ? "pending" : scoreTone(value);
  const r = 9, c = 2 * Math.PI * r;
  const spoken = pending ? "Scoring" : value === null ? "Partial score" : `Score ${value} out of 100`;
  const content = <>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} className="score-badge-track" />
      <circle cx="12" cy="12" r={r} className="score-badge-arc" strokeDasharray={c} strokeDashoffset={pending ? c * 0.72 : c * (1 - Math.max(0, Math.min(100, value ?? 0)) / 100)} />
    </svg>
    {!pending && <span aria-hidden="true">{value === null ? "–" : value}</span>}
  </>;
  if (onOpen && !pending && score)
    return <button type="button" className="score-badge" data-tone={tone} aria-label={(label ? label + ": " : "") + spoken + ". Open full score"} onClick={event => { event.stopPropagation(); onOpen(); }}>{content}</button>;
  return <span className="score-badge" data-tone={tone} role="img" aria-label={spoken}>{content}</span>;
}
