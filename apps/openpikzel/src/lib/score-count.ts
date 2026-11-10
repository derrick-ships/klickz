// Score count-up and pillar fills (OP-11, DELIGHT.md approved exception 2).
// Pure timing and run-once rules; the React hook lives in components/creative/score-count.tsx.

/** Overall number: 0 → N. */
export const COUNT_UP_MS = 600;
/** Each pillar bar fill. */
export const PILLAR_FILL_MS = 400;
/** Delay between pillar bars; the 5th bar ends at 4 × 50 + 400 = 600 ms, with the number. */
export const PILLAR_STAGGER_MS = 50;
/**
 * Same curve as the `--ease-out-count` token in tokens.css (used by the pillar fills).
 * Gentler than the global `--ease-out`, so the number does not sit just short of the score.
 */
export const EASE_OUT_COUNT: readonly [number, number, number, number] = [0.33, 1, 0.68, 1];

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p: number) => {
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - p, d = dx(t);
      if (Math.abs(err) < 1e-6) return y(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = p;
    for (let i = 0; i < 30; i++) {
      const v = x(t);
      if (Math.abs(v - p) < 1e-6) break;
      if (v < p) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return y(t);
  };
}
const curve = bezier(...EASE_OUT_COUNT);

export function easeOut(progress: number): number {
  if (!(progress > 0)) return 0;
  if (progress >= 1) return 1;
  return Math.min(1, Math.max(0, curve(progress)));
}

function clampScore(target: number) {
  return Math.min(100, Math.max(0, Math.round(target)));
}

/** The integer to show `elapsedMs` into the count (nearest to the curve). A broken clock shows the final value. */
export function countUpValue(elapsedMs: number, target: number, durationMs = COUNT_UP_MS): number {
  const end = clampScore(target);
  if (!Number.isFinite(elapsedMs) || elapsedMs >= durationMs) return end;
  if (elapsedMs <= 0) return 0;
  // Nearest integer to the curve: never above the score, and the true score shows as soon as the
  // curve is within half a point of it, rather than idling one below it until the last frame.
  return Math.min(end, Math.round(end * easeOut(elapsedMs / durationMs)));
}

type KeyStorage = Pick<Storage, "getItem" | "setItem">;
export type SeenRegistry = { has(key: string): boolean; add(key: string): void };
const STORAGE_KEY = "openpikzels:score-reveals:v1";

/** Remembers which score results have already been revealed, so revisits and reloads stay still. */
export function createSeenRegistry(storage: KeyStorage | null | undefined, cap = 200): SeenRegistry {
  let keys: string[] = [];
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) keys = parsed.filter((k): k is string => typeof k === "string").slice(-cap);
  } catch { keys = []; }
  const set = new Set(keys);
  return {
    has: key => set.has(key),
    add(key) {
      if (set.has(key)) return;
      set.add(key); keys.push(key);
      while (keys.length > cap) set.delete(keys.shift()!);
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch { /* memory only */ }
    },
  };
}

/** One result = one creation + one score. A re-score is a new result; a revisit is not. */
export function revealKey(
  creationId: string | null | undefined,
  score: { created_at?: string; inputDigest?: string } | null | undefined,
): string | null {
  if (!creationId || !score) return null;
  const stamp = score.created_at || score.inputDigest;
  return stamp ? creationId + ":" + stamp : null;
}

/**
 * Tracks whether the selected result's score arrived during this session. The key present when a
 * creation is first selected (or the studio mounts) is its baseline: showing it is static. Only a
 * change to a new key while it stays selected counts as an arrival. Re-selecting re-baselines.
 */
export function createArrivalTracker() {
  let subject: string | null = null, baseline: string | null = null;
  return {
    /** `fresh`: the creation itself appeared this session (for example a new generation), so it has no older score. */
    observe(id: string | null, key: string | null, fresh = false): boolean {
      if (id !== subject) { subject = id; baseline = fresh ? null : key; }
      return !!key && key !== baseline;
    },
  };
}

/**
 * Remembers which creations were in this account's library when it finished loading. Creations that
 * appear later (new generations, whose score may now arrive together with the image) are new this
 * session. Until a load for the current owner finishes, nothing is new.
 */
export function createLibrarySnapshot() {
  let owner: string | null | undefined, sawLoading = false, ids: Set<string> | null = null;
  return {
    observe(nextOwner: string | null, loading: boolean, creationIds: readonly string[]): boolean {
      if (nextOwner !== owner) { owner = nextOwner; ids = null; sawLoading = loading; }
      if (loading) sawLoading = true;
      else if (sawLoading && !ids) ids = new Set(creationIds);
      return !!ids;
    },
    isNew(id: string | null | undefined): boolean { return !!id && !!ids && !ids.has(id); },
  };
}

/** What a polite live region receives once per reveal: the final value only. */
export function scoreAnnouncement(overall: number) {
  return "OpenPikzels Score " + overall + " out of 100";
}

/**
 * "animate": count now. "settle": reduced motion, show final and announce once. "static": show final,
 * no ticks, no announcement. "wait": arrived, but covered (for example by the analysis dialog).
 * Only a score that arrived this session can reveal; localStorage guards against replay on reload.
 */
export type RevealPlan = "animate" | "settle" | "static" | "wait";
export function planReveal(input: {
  key: string | null; overall: number | null; reduced: boolean; paused: boolean; arrived: boolean; seen: SeenRegistry;
}): RevealPlan {
  const { key, overall, reduced, paused, arrived, seen } = input;
  if (!key || overall === null || !arrived || seen.has(key)) return "static";
  if (paused) return "wait";
  seen.add(key);
  return reduced ? "settle" : "animate";
}

/** Time-based count. Frames only sample the clock, so dropped frames never change the end value. */
export function runCountUp(opts: {
  target: number; durationMs?: number; now: () => number;
  raf: (cb: (time: number) => void) => number; cancel: (id: number) => void;
  onFrame: (value: number) => void; onDone: () => void;
}): () => void {
  const duration = opts.durationMs ?? COUNT_UP_MS, start = opts.now(), end = clampScore(opts.target);
  let id = 0, stopped = false;
  const tick = (time: number) => {
    if (stopped) return;
    const elapsed = time - start, value = countUpValue(elapsed, end, duration);
    opts.onFrame(value);
    if (end === 0 || !(elapsed < duration)) { stopped = true; opts.onDone(); return; }
    id = opts.raf(tick);
  };
  id = opts.raf(tick);
  return () => { if (!stopped) { stopped = true; opts.cancel(id); } };
}
