// OP-10b: the reveal CSS carries the same numbers as the OP-10a rules, and animates compositor-only properties.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { REVEAL_MS, REVEAL_STAGGER_MS, REVEAL_REDUCED_MS } from "@/lib/image-reveal";

const review = readFileSync(new URL("../src/app/review.css", import.meta.url), "utf8");

describe("image reveal CSS", () => {
  it("uses the approved recipe: 450 ms, 70 ms stagger, blur 12px, scale 1.02, opacity 0", () => {
    // The 450 ms image reveal runs on --ease-out-count (Lead spec 2026-11-13): the global --ease-out lands its blur in the first
    // third, so after 150 ms it already read as sharp. Only the reveals use it; the placeholder fade and the global token stay.
    expect(review).toContain(`.image-reveal { animation: image-reveal ${REVEAL_MS}ms var(--ease-out-count) calc(var(--i, 0) * ${REVEAL_STAGGER_MS}ms) both;`);
    expect(review).toContain(`.delivery-reveal { animation: delivery-reveal ${REVEAL_MS}ms var(--ease-out-count) calc(var(--i, 0) * ${REVEAL_STAGGER_MS}ms) both;`);
    expect(review).toContain(".delivery-placeholder.leaving { animation: delivery-exit 200ms var(--ease-out) both;");
    const frames = review.match(/@keyframes image-reveal \{([^}]*\}[^}]*)\}/)![1];
    expect(frames).toContain("filter: blur(12px)"); expect(frames).toContain("transform: scale(1.02)"); expect(frames).toContain("opacity: 0");
    expect(frames.match(/[a-z-]+(?=:)/g)!.every(p => ["filter", "transform", "opacity"].includes(p))).toBe(true);
  });
  it("a delivered image still loading is labelled only once the placeholder has gone", () => {
    // Independent check #27 at 214e6bf: the tile went blank while slow bytes were on the way. Behaviour is proven frame by frame in
    // tests/browser/image-reveal.spec.ts; this guards the gate that keeps an image held under the placeholder from flashing it.
    expect(review).toContain('.delivery-slot:not(:has(> .delivery-placeholder)) .delivery-tile:has(> img.delivery-reveal-pending)::after { content: "Loading image…";');
  });
  it("reduced motion is a 120 ms opacity fade only", () => {
    const reduced = review.match(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.image-reveal[^}]*\}/)![0];
    expect(reduced).toContain(`animation: image-reveal-fade ${REVEAL_REDUCED_MS}ms linear both !important`);
    // A remount resumes from RevealImage's negative delay; a positive stagger is dropped (OP-10b FIX r1).
    expect(reduced).toContain("animation-delay: min(var(--reveal-delay, 0ms), 0ms) !important");
    expect(review).toMatch(/@keyframes image-reveal-fade \{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/);
  });
});
