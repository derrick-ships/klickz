import { describe, expect, it } from "vitest";
import { createArrivals, createRevealRegistry, planImageReveal, resumeDelay, staggerPositions, REVEAL_MS, REVEAL_STAGGER_MS, REVEAL_REDUCED_MS } from "@/lib/image-reveal";

describe("image arrivals", () => {
  it("keeps loading and hydrated history static, including an empty initial library", () => {
    const arrivals = createArrivals();
    arrivals.observe("a", true, ["old"]);
    expect(arrivals.arrival("old")).toBeNull();
    arrivals.observe("a", false, ["old"]);
    expect(arrivals.arrival("old")).toBeNull();
    arrivals.observe("b", true, []);
    arrivals.observe("b", false, []);
    arrivals.observe("b", false, ["new"]);
    expect(arrivals.arrival("new")).toEqual({ batch: 1, index: 0 });
  });
  it("groups new ids once, and resets when the owner changes", () => {
    const arrivals = createArrivals();
    arrivals.observe("a", true, []);
    arrivals.observe("a", false, ["old"]);
    arrivals.observe("a", false, ["x", "x", "y", "old"]);
    expect(arrivals.arrival("x")).toEqual({ batch: 1, index: 0 });
    expect(arrivals.arrival("y")).toEqual({ batch: 1, index: 1 });
    arrivals.observe("a", false, ["z", "x", "y"]);
    expect(arrivals.arrival("z")).toEqual({ batch: 2, index: 0 });
    arrivals.observe("b", false, ["x"]);
    expect(arrivals.arrival("x")).toBeNull();
    arrivals.observe("b", true, []);
    arrivals.observe("b", false, ["x"]);
    expect(arrivals.arrival("x")).toBeNull();
  });
  it("assigns stagger indices in rendered order without counting duplicates", () => {
    const a = { x: { batch: 1, index: 0 }, y: { batch: 1, index: 1 }, z: { batch: 2, index: 0 } };
    expect(Object.fromEntries(staggerPositions(["y", "y", "old", "z", "x"], id => a[id as keyof typeof a] ?? null))).toEqual({ y: 0, z: 0, x: 1 });
  });
});

describe("reveal lifecycle", () => {
  it("only plans eligible generated arrivals and claims only on successful load", () => {
    const seen = createRevealRegistry();
    seen.setOwner("a");
    const base = { surface: "canvas" as const, id: "x", arrived: true, uploaded: false, seen };
    expect(planImageReveal(base)).toBe("reveal");
    expect(planImageReveal({ ...base, arrived: false })).toBe("static");
    expect(planImageReveal({ ...base, uploaded: true })).toBe("static");
    expect(seen.claim("canvas", "x", false, 1000)).toBe(false);
    expect(seen.has("canvas", "x")).toBe(false);
    expect(seen.claim("canvas", "x", true, 1000)).toBe(true);
    expect(seen.claim("canvas", "x", true, 1010)).toBe(false);
    expect(planImageReveal(base)).toBe("static");
    expect(planImageReveal({ ...base, surface: "card" })).toBe("reveal");
    seen.setOwner("b");
    expect(seen.has("canvas", "x")).toBe(false);
    seen.setOwner("a");
    expect(seen.has("canvas", "x")).toBe(false);
  });
  it("resumes interrupted timing without replay and expires at the boundary", () => {
    expect([REVEAL_MS, REVEAL_STAGGER_MS, REVEAL_REDUCED_MS]).toEqual([450, 70, 120]);
    expect(resumeDelay({ startedAt: 1000, now: 1100, index: 2, reduced: false })).toBe(40);
    expect(resumeDelay({ startedAt: 1000, now: 1200, index: 2, reduced: false })).toBe(-60);
    expect(resumeDelay({ startedAt: 1000, now: 1590, index: 2, reduced: false })).toBeNull();
    expect(resumeDelay({ startedAt: 1000, now: 1060, index: 3, reduced: true })).toBe(-60);
    expect(resumeDelay({ startedAt: 1000, now: 1120, index: 3, reduced: true })).toBeNull();
  });
});
