"use client";
// OP-11: one-time score count-up and pillar fills (DELIGHT.md approved exception 2).
import { useLayoutEffect, useRef, useState } from "react";
import { countUpValue, createArrivalTracker, createLibrarySnapshot, createSeenRegistry, planReveal, runCountUp, scoreAnnouncement, type SeenRegistry } from "@/lib/score-count";

let registry: SeenRegistry | null = null;
function seenResults() {
  if (!registry) {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { storage = null; }
    registry = createSeenRegistry(storage);
  }
  return registry;
}

export type ScoreReveal = { running: boolean; value: number | null; run: number; announce: string };

/**
 * Counts a score from 0 once, only when it `arrived` during this session (see createArrivalTracker).
 * Scores already present at mount or selection, revisits, reloads, partial scores and reduced
 * motion show the final value with no ticks. `paused` (for example, a dialog covering the panel)
 * defers the claim so the reveal plays where it can be seen. `announce` is the text for a polite
 * live region: empty until the reveal settles, then the final value once; static views never set it.
 */
export function useScoreReveal(
  key: string | null, overall: number | null, { paused = false, arrived = false } = {},
): ScoreReveal {
  const [state, setState] = useState<ScoreReveal>({ running: false, value: overall, run: 0, announce: "" });
  const live = useRef<{ key: string; startedAt: number; done: boolean } | null>(null);
  useLayoutEffect(() => {
    const idle = () => setState(s => {
      const announce = live.current?.key === key ? s.announce : "";
      return s.running || s.value !== overall || s.announce !== announce ? { ...s, running: false, value: overall, announce } : s;
    });
    if (!key || overall === null) { idle(); return; }
    let entry = live.current && live.current.key === key && !live.current.done ? live.current : null;
    if (!entry) {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const plan = planReveal({ key, overall, reduced, paused, arrived, seen: seenResults() });
      if (plan === "settle") {
        // Reduced motion: final value at once, announced once (after the region is in the tree).
        live.current = { key, startedAt: performance.now(), done: true };
        setState(s => ({ ...s, running: false, value: overall, announce: "" }));
        const timer = setTimeout(() => setState(s => ({ ...s, announce: scoreAnnouncement(overall) })), 100);
        return () => clearTimeout(timer);
      }
      if (plan !== "animate") { idle(); return; }
      entry = live.current = { key, startedAt: performance.now(), done: false };
      setState(s => ({ running: true, value: 0, run: s.run + 1, announce: "" }));
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
      onDone: () => { current.done = true; setState(s => ({ ...s, running: false, value: overall, announce: scoreAnnouncement(overall) })); },
    });
  }, [key, overall, paused, arrived]);
  return state;
}

/**
 * True when the selected creation's score arrived during this session: it changed while selected,
 * or the creation itself appeared after this account's library loaded (a new generation, whose
 * score can arrive together with the image). Stable across re-renders.
 */
export function useScoreArrival(owner: string | null, loading: boolean, creationIds: readonly string[], subject: string | null, key: string | null) {
  const refs = useRef<{ tracker: ReturnType<typeof createArrivalTracker>; library: ReturnType<typeof createLibrarySnapshot> } | null>(null);
  if (!refs.current) refs.current = { tracker: createArrivalTracker(), library: createLibrarySnapshot() };
  refs.current.library.observe(owner, loading, creationIds);
  return refs.current.tracker.observe(subject, key, refs.current.library.isNew(subject));
}

/** Polite live region for a reveal. Keep it mounted before the score arrives so the change is announced. */
export function ScoreAnnouncer({ text }: { text: string }) {
  return <p className="sr-only" aria-live="polite" aria-atomic="true" data-score-announcer="">{text}</p>;
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
