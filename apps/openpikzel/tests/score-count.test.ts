import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  COUNT_UP_MS, PILLAR_FILL_MS, PILLAR_STAGGER_MS, EASE_OUT_COUNT,
  easeOut, countUpValue, createSeenRegistry, planReveal, runCountUp, revealKey,
  createArrivalTracker, createLibrarySnapshot, scoreAnnouncement,
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
  it("stays short and lands the number and the last bar together", () => {
    expect(COUNT_UP_MS).toBe(600);
    expect(PILLAR_FILL_MS).toBe(400);
    expect(PILLAR_STAGGER_MS).toBe(50);
    // Five pillars: the 5th bar starts at 4 x 50ms and ends exactly when the number does.
    expect(4 * PILLAR_STAGGER_MS + PILLAR_FILL_MS).toBe(COUNT_UP_MS);
  });

  it("uses the same curve as the CSS --ease-out-count token, not the global --ease-out", () => {
    expect(EASE_OUT_COUNT).toEqual([0.33, 1, 0.68, 1]);
    const tokens = readFileSync(new URL("../src/app/tokens.css", import.meta.url), "utf8");
    expect(tokens).toMatch(/--ease-out-count:\s*cubic-bezier\(0\.33,\s*1,\s*0\.68,\s*1\)/);
    expect(tokens).toMatch(/--ease-out:\s*cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)/);
    const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/pillar-fill 400ms var\(--ease-out-count\) calc\(var\(--i, 0\) \* 50ms\)/);
  });

  it("matches cubic-bezier(.33,1,.68,1) exactly, so the count never disagrees with the bars", () => {
    // Independent reference: sample the Bezier parametrically and interpolate x -> y.
    const [x1, y1, x2, y2] = [0.33, 1, 0.68, 1], N = 200000, xs: number[] = [], ys: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = 3 * (1 - u) * (1 - u) * u, b = 3 * (1 - u) * u * u, c = u * u * u;
      xs.push(a * x1 + b * x2 + c); ys.push(a * y1 + b * y2 + c);
    }
    const reference = (x: number) => {
      let lo = 0, hi = N;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
      const f = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
      return ys[lo] + f * (ys[hi] - ys[lo]);
    };
    for (let i = 0; i <= 1000; i++) expect(Math.abs(easeOut(i / 1000) - reference(i / 1000))).toBeLessThan(1e-4);
    // At every frame (60 and 120 Hz) the shown integer is the curve rounded (within 0.5, so within 1 unit).
    for (const target of [1, 7, 50, 72, 78, 99, 100])
      for (const step of [1000 / 60, 1000 / 120])
        for (let t = 0; t < COUNT_UP_MS; t += step)
          expect(Math.abs(countUpValue(t, target) - target * reference(t / COUNT_UP_MS))).toBeLessThanOrEqual(0.5 + 1e-3);
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
    expect(countUpValue(COUNT_UP_MS - 1, 100)).toBeLessThanOrEqual(100);
    expect(countUpValue(1, 100)).toBeLessThan(100);
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
  const base = { reduced: false, paused: false, arrived: true };
  it("animates a score that arrived this session once, then shows it still", () => {
    const r = seen();
    expect(planReveal({ ...base, key: "c1:t", overall: 72, seen: r })).toBe("animate");
    expect(planReveal({ ...base, key: "c1:t", overall: 72, seen: r })).toBe("static");
  });
  it("repro 1: an old-dated score in a fresh registry stays static unless it arrived this session", () => {
    const key = revealKey("c-old", { created_at: "2026-01-01T00:00:00Z" });
    expect(planReveal({ ...base, arrived: false, key, overall: 64, seen: seen() })).toBe("static");
    expect(planReveal({ ...base, arrived: true, key, overall: 64, seen: seen() })).toBe("animate");
  });
  it("repro 2: an entry evicted by 200 newer ones stays static unless it arrived this session", () => {
    const storage = memoryStorage(), r = createSeenRegistry(storage);
    r.add("c1:old");
    for (let i = 0; i < 200; i++) r.add("c" + i + ":new");
    const reloaded = createSeenRegistry(storage);
    expect(reloaded.has("c1:old")).toBe(false);
    expect(planReveal({ ...base, arrived: false, key: "c1:old", overall: 70, seen: reloaded })).toBe("static");
  });
  it("a static view never consumes the reveal", () => {
    const r = seen();
    expect(planReveal({ ...base, arrived: false, key: "c1:t", overall: 72, seen: r })).toBe("static");
    expect(r.has("c1:t")).toBe(false);
  });
  it("settles at once with reduced motion (announced, no ticks) and never replays later", () => {
    const r = seen();
    expect(planReveal({ ...base, reduced: true, key: "c1:t", overall: 72, seen: r })).toBe("settle");
    expect(planReveal({ ...base, key: "c1:t", overall: 72, seen: r })).toBe("static");
  });
  it("does not animate partial results and waits while hidden behind a dialog", () => {
    const r = seen();
    expect(planReveal({ ...base, key: "c1:t", overall: null, seen: r })).toBe("static");
    expect(planReveal({ ...base, paused: true, key: "c2:t", overall: 60, seen: r })).toBe("wait");
    expect(planReveal({ ...base, key: "c2:t", overall: 60, seen: r })).toBe("animate");
    expect(planReveal({ ...base, key: null, overall: 60, seen: r })).toBe("static");
  });
});

describe("arrival tracker (in-session score arrivals)", () => {
  it("treats a score that is already there at selection as not arrived", () => {
    const t = createArrivalTracker();
    expect(t.observe("c1", "c1:2026-01-01")).toBe(false);
    expect(t.observe("c1", "c1:2026-01-01")).toBe(false);
  });
  it("a transition during the session still animates: no score, or an older score, to a new score", () => {
    const t = createArrivalTracker();
    expect(t.observe("c1", null)).toBe(false);
    expect(t.observe("c1", "c1:t1")).toBe(true);
    expect(t.observe("c1", "c1:t1")).toBe(true); // stable across re-renders while selected
    const u = createArrivalTracker();
    expect(u.observe("c2", "c2:old")).toBe(false);
    expect(u.observe("c2", "c2:new")).toBe(true);
  });
  it("re-baselines on every selection, so revisits are static", () => {
    const t = createArrivalTracker();
    t.observe("c1", null); expect(t.observe("c1", "c1:t1")).toBe(true);
    expect(t.observe("c2", "c2:x")).toBe(false);
    expect(t.observe("c1", "c1:t1")).toBe(false);
    expect(t.observe(null, null)).toBe(false);
  });
});

describe("arrival tracker: creations new this session", () => {
  it("a creation that appeared this session counts its first score as arrived, even if it comes with the image", () => {
    const t = createArrivalTracker();
    expect(t.observe("new", "new:t1", true)).toBe(true);
    expect(t.observe("old", "old:t0", false)).toBe(false);
  });
});

describe("library snapshot (which creations existed when this account's library loaded)", () => {
  it("knows nothing while loading, then treats only later creations as new", () => {
    const lib = createLibrarySnapshot();
    expect(lib.observe("u1", true, [])).toBe(false);
    lib.observe("u1", false, ["a", "b"]);
    expect(lib.isNew("a")).toBe(false);
    lib.observe("u1", false, ["c", "a", "b"]);
    expect(lib.isNew("c")).toBe(true);
    expect(lib.isNew("a")).toBe(false);
  });
  it("is static until the first load finishes, so an initial library is never new", () => {
    const lib = createLibrarySnapshot();
    lib.observe("u1", true, []);
    expect(lib.isNew("a")).toBe(false);
    lib.observe("u1", false, ["a"]);
    expect(lib.isNew("a")).toBe(false);
  });
  it("re-snapshots after an account switch only once that account's load finishes", () => {
    const lib = createLibrarySnapshot();
    lib.observe("u1", true, []); lib.observe("u1", false, ["a"]);
    // The first render after the switch still holds the previous account's rows and loading=false.
    lib.observe("u2", false, ["a"]);
    expect(lib.isNew("x")).toBe(false);
    lib.observe("u2", true, ["a"]);
    lib.observe("u2", false, ["x", "y"]);
    expect(lib.isNew("x")).toBe(false);
    lib.observe("u2", false, ["z", "x", "y"]);
    expect(lib.isNew("z")).toBe(true);
  });
});

describe("scoreAnnouncement", () => {
  it("holds only the final value", () => {
    expect(scoreAnnouncement(78)).toBe("OpenPikzels Score 78 out of 100");
    expect(scoreAnnouncement(0)).toBe("OpenPikzels Score 0 out of 100");
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

  it("shows the true score before the last frame instead of idling one below it", () => {
    // 78 at 550ms is 77.97 on the curve: the number already reads 78 while the 5th bar finishes.
    expect(countUpValue(550, 78)).toBe(78);
    expect(countUpValue(300, 78)).toBeLessThan(78);
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
