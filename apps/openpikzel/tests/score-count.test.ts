import { describe, it, expect } from "vitest";
import {
  COUNT_UP_MS, PILLAR_FILL_MS, PILLAR_STAGGER_MS,
  easeOut, countUpValue, createSeenRegistry, planReveal, runCountUp, revealKey,
} from "../src/lib/score-count";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    data,
  };
}

// A manual frame scheduler: the test decides which frames the browser "delivers".
function manualFrames() {
  let next = 1;
  const queue = new Map<number, (t: number) => void>();
  return {
    raf: (cb: (t: number) => void) => { const id = next++; queue.set(id, cb); return id; },
    cancel: (id: number) => { queue.delete(id); },
    frame(t: number) { const cbs = [...queue.values()]; queue.clear(); cbs.forEach(cb => cb(t)); },
    pending: () => queue.size,
  };
}

describe("score count-up timing", () => {
  it("stays short, calm and inside the approved budget", () => {
    expect(COUNT_UP_MS).toBe(700);
    expect(PILLAR_STAGGER_MS).toBe(50);
    // Five pillars: the last bar finishes no later than the number.
    expect(4 * PILLAR_STAGGER_MS + PILLAR_FILL_MS).toBeLessThanOrEqual(COUNT_UP_MS);
    expect(COUNT_UP_MS).toBeGreaterThanOrEqual(600);
    expect(COUNT_UP_MS).toBeLessThanOrEqual(900);
  });

  it("eases out: starts fast, lands softly, and hits both ends exactly", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.75);
    let last = 0;
    for (let i = 1; i <= 100; i++) { const v = easeOut(i / 100); expect(v).toBeGreaterThanOrEqual(last); last = v; }
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
  });
});

describe("countUpValue", () => {
  it("counts from 0 to the final integer and never overshoots", () => {
    expect(countUpValue(0, 72)).toBe(0);
    expect(countUpValue(COUNT_UP_MS, 72)).toBe(72);
    expect(countUpValue(COUNT_UP_MS * 5, 72)).toBe(72);
    let last = 0;
    for (let t = 0; t <= COUNT_UP_MS; t += 16) {
      const v = countUpValue(t, 72);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(72);
      last = v;
    }
    expect(countUpValue(COUNT_UP_MS / 2, 72)).toBeGreaterThan(36);
    expect(countUpValue(COUNT_UP_MS - 1, 72)).toBeLessThanOrEqual(72);
  });

  it("handles the edges: 0, 100, out-of-range targets and bad clocks", () => {
    for (const t of [0, 100, 350, 700]) expect(countUpValue(t, 0)).toBe(0);
    expect(countUpValue(COUNT_UP_MS, 100)).toBe(100);
    expect(countUpValue(COUNT_UP_MS - 1, 100)).toBeLessThan(100);
    expect(countUpValue(COUNT_UP_MS, 140)).toBe(100);
    expect(countUpValue(COUNT_UP_MS, -5)).toBe(0);
    expect(countUpValue(COUNT_UP_MS, 71.6)).toBe(72);
    expect(countUpValue(-50, 72)).toBe(0);
    expect(countUpValue(Number.NaN, 72)).toBe(72);
    expect(countUpValue(Number.POSITIVE_INFINITY, 72)).toBe(72);
  });
});

describe("run-once guard", () => {
  it("remembers seen results across a reload of the same storage", () => {
    const storage = memoryStorage();
    const a = createSeenRegistry(storage);
    expect(a.has("c1:t1")).toBe(false);
    a.add("c1:t1");
    expect(a.has("c1:t1")).toBe(true);
    const afterReload = createSeenRegistry(storage);
    expect(afterReload.has("c1:t1")).toBe(true);
    expect(afterReload.has("c1:t2")).toBe(false);
  });

  it("caps what it keeps and survives broken or blocked storage", () => {
    const storage = memoryStorage();
    const r = createSeenRegistry(storage, 3);
    ["a", "b", "c", "d"].forEach(k => r.add(k));
    expect(r.has("a")).toBe(false);
    expect(r.has("d")).toBe(true);
    expect(JSON.parse(storage.data.values().next().value!)).toHaveLength(3);

    storage.data.set([...storage.data.keys()][0], "{not json");
    expect(createSeenRegistry(storage).has("d")).toBe(false);

    const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() {} };
    const m = createSeenRegistry(blocked);
    m.add("x");
    expect(m.has("x")).toBe(true);
    const none = createSeenRegistry(null);
    none.add("y");
    expect(none.has("y")).toBe(true);
  });

  it("keys a result by creation and score, so a re-score is new but a revisit is not", () => {
    expect(revealKey("c1", { created_at: "2026-11-10T10:00:00Z" })).toBe("c1:2026-11-10T10:00:00Z");
    expect(revealKey("c1", { created_at: "2026-11-10T10:00:00Z" })).toBe(revealKey("c1", { created_at: "2026-11-10T10:00:00Z" }));
    expect(revealKey("c1", { created_at: "2026-11-10T10:05:00Z" })).not.toBe(revealKey("c1", { created_at: "2026-11-10T10:00:00Z" }));
    expect(revealKey("c1", { inputDigest: "abc" } as never)).toBe("c1:abc");
    expect(revealKey(null, { created_at: "x" })).toBeNull();
    expect(revealKey("c1", null)).toBeNull();
  });
});

describe("planReveal", () => {
  const seen = () => createSeenRegistry(memoryStorage());
  it("animates a new score once, then shows it still", () => {
    const r = seen();
    expect(planReveal({ key: "c1:t", overall: 72, reduced: false, paused: false, seen: r })).toBe("animate");
    expect(planReveal({ key: "c1:t", overall: 72, reduced: false, paused: false, seen: r })).toBe("final");
  });
  it("shows final values at once with reduced motion and never replays later", () => {
    const r = seen();
    expect(planReveal({ key: "c1:t", overall: 72, reduced: true, paused: false, seen: r })).toBe("final");
    expect(planReveal({ key: "c1:t", overall: 72, reduced: false, paused: false, seen: r })).toBe("final");
  });
  it("does not animate partial results and waits while hidden behind a dialog", () => {
    const r = seen();
    expect(planReveal({ key: "c1:t", overall: null, reduced: false, paused: false, seen: r })).toBe("final");
    expect(planReveal({ key: "c2:t", overall: 60, reduced: false, paused: true, seen: r })).toBe("wait");
    expect(planReveal({ key: "c2:t", overall: 60, reduced: false, paused: false, seen: r })).toBe("animate");
    expect(planReveal({ key: null, overall: 60, reduced: false, paused: false, seen: r })).toBe("final");
  });
});

describe("runCountUp", () => {
  it("drives frames from the clock and lands exactly on the final value", () => {
    const f = manualFrames(), values: number[] = [];
    let done = 0;
    runCountUp({ target: 72, now: () => 0, raf: f.raf, cancel: f.cancel, onFrame: v => values.push(v), onDone: () => done++ });
    f.frame(0); f.frame(100); f.frame(350); f.frame(699); f.frame(700);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(72);
    expect(done).toBe(1);
    expect(f.pending()).toBe(0);
  });

  it("is still correct when frames are dropped or the tab was hidden", () => {
    const f = manualFrames(), values: number[] = [];
    let done = 0;
    runCountUp({ target: 88, now: () => 1000, raf: f.raf, cancel: f.cancel, onFrame: v => values.push(v), onDone: () => done++ });
    f.frame(1016);
    f.frame(5000); // one late frame after a long stall
    expect(values).toHaveLength(2);
    expect(values.at(-1)).toBe(88);
    expect(done).toBe(1);
  });

  it("stops cleanly when cancelled, so a newer result can take over", () => {
    const f = manualFrames(), values: number[] = [];
    let done = 0;
    const stop = runCountUp({ target: 50, now: () => 0, raf: f.raf, cancel: f.cancel, onFrame: v => values.push(v), onDone: () => done++ });
    f.frame(100);
    stop();
    f.frame(800);
    expect(values).toHaveLength(1);
    expect(done).toBe(0);
    expect(f.pending()).toBe(0);
  });

  it("finishes a zero score on the first frame", () => {
    const f = manualFrames(), values: number[] = [];
    let done = 0;
    runCountUp({ target: 0, now: () => 0, raf: f.raf, cancel: f.cancel, onFrame: v => values.push(v), onDone: () => done++ });
    f.frame(16);
    expect(values).toEqual([0]);
    expect(done).toBe(1);
  });
});
