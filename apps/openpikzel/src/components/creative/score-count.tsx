"use client";
// OP-11: one-time score count-up and pillar fills (DELIGHT.md approved exception 2).
import { useLayoutEffect, useRef, useState } from "react";
import { countUpValue, createSeenRegistry, planReveal, runCountUp, type SeenRegistry } from "@/lib/score-count";

let registry: SeenRegistry | null = null;
function seenResults() {
  if (!registry) {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { storage = null; }
    registry = createSeenRegistry(storage);
  }
  return registry;
}

export type ScoreReveal = { running: boolean; value: number | null; run: number };

/**
 * Counts a new score from 0 once per result key. Revisits, reloads, partial scores and
 * reduced motion show the final value at once. `paused` (for example, a dialog covering the
 * panel) defers the claim so the reveal plays where it can be seen.
 */
export function useScoreReveal(key: string | null, overall: number | null, { paused = false } = {}): ScoreReveal {
  const [state, setState] = useState<ScoreReveal>({ running: false, value: overall, run: 0 });
  const live = useRef<{ key: string; startedAt: number; done: boolean } | null>(null);
  useLayoutEffect(() => {
    const idle = () => setState(s => (s.running || s.value !== overall ? { ...s, running: false, value: overall } : s));
    if (!key || overall === null) { idle(); return; }
    let entry = live.current && live.current.key === key && !live.current.done ? live.current : null;
    if (!entry) {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (planReveal({ key, overall, reduced, paused, seen: seenResults() }) !== "animate") { idle(); return; }
      entry = live.current = { key, startedAt: performance.now(), done: false };
      setState(s => ({ running: true, value: 0, run: s.run + 1 }));
    } else {
      const startedAt = entry.startedAt;
      setState(s => ({ ...s, running: true, value: countUpValue(performance.now() - startedAt, overall) }));
    }
    const current = entry;
    return runCountUp({
      target: overall,
      now: () => current.startedAt,
      // Sample performance.now() so frames and resumes share one clock and never step backwards.
      raf: cb => requestAnimationFrame(() => cb(performance.now())),
      cancel: id => cancelAnimationFrame(id),
      onFrame: value => setState(s => (s.value === value ? s : { ...s, value })),
      onDone: () => { current.done = true; setState(s => ({ ...s, running: false, value: overall })); },
    });
  }, [key, overall, paused]);
  return state;
}

/**
 * The visible number. While counting, the ticks are aria-hidden and the accessible text holds
 * only the final value; afterwards it is plain text, exactly as before. Ticks are padded with
 * invisible zeros to the final digit count, so with tabular numerals the "/100" never moves.
 */
export function ScoreNumber({ reveal, final }: { reveal: ScoreReveal; final: number }) {
  if (!reveal.running || reveal.value === null) return <span className="score-count">{final}</span>;
  const pad = Math.max(0, String(final).length - String(reveal.value).length);
  return (
    <>
      <span className="score-count" aria-hidden="true">
        {pad > 0 && <span className="score-count-pad">{"0".repeat(pad)}</span>}
        {reveal.value}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
