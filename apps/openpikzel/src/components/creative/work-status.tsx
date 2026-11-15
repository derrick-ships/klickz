"use client";
import { useEffect, useState } from "react";
import { poseFor, verbFor, VERB_INTERVAL_MS, type WorkStage } from "@/lib/ui-spinner-verbs";

/** Live-updating elapsed milliseconds since `key` changed; 250ms granularity. */
export function useElapsed(key: unknown, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(performance.now() - start), 250);
    return () => clearInterval(timer);
  }, [key, running]);
  return elapsed;
}

/**
 * Pik and a rotating verb: one short visual line while something works. Purely decorative (aria-hidden):
 * the caller owns the live region that names the concrete stage.
 */
export function WorkStatus({ stage, elapsedMs, detail, seed = 0 }: { stage: WorkStage; elapsedMs: number; detail?: string | null; seed?: number }) {
  const tick = Math.floor(elapsedMs / VERB_INTERVAL_MS);
  const verb = verbFor(stage, tick, seed), pose = poseFor(stage, tick);
  return (
    <span className="work-status" aria-hidden="true" data-stage={stage}>
      <span className="work-pik"><img key={pose} src={`/pik/${pose}.webp`} alt="" width={44} height={44} decoding="async" draggable={false} /></span>
      <span className="work-verb"><span key={verb + tick} className="work-verb-word">{verb}…</span></span>
      <span className="work-meta">{detail ? <>{detail} · </> : null}{Math.floor(elapsedMs / 1000)}s</span>
    </span>
  );
}
