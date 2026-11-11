// OP-10b: the reveal CSS carries the same numbers as the OP-10a rules, and animates compositor-only properties.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { REVEAL_MS, REVEAL_STAGGER_MS, REVEAL_REDUCED_MS } from "@/lib/image-reveal";

const review = readFileSync(new URL("../src/app/review.css", import.meta.url), "utf8");

describe("image reveal CSS", () => {
  it("uses the approved recipe: 450 ms, 70 ms stagger, blur 12px, scale 1.02, opacity 0", () => {
    expect(review).toContain(`.image-reveal { animation: image-reveal ${REVEAL_MS}ms var(--ease-out) calc(var(--i, 0) * ${REVEAL_STAGGER_MS}ms) both;`);
    const frames = review.match(/@keyframes image-reveal \{([^}]*\}[^}]*)\}/)![1];
    expect(frames).toContain("filter: blur(12px)"); expect(frames).toContain("transform: scale(1.02)"); expect(frames).toContain("opacity: 0");
    expect(frames.match(/[a-z-]+(?=:)/g)!.every(p => ["filter", "transform", "opacity"].includes(p))).toBe(true);
  });
  it("reduced motion is a 120 ms opacity fade only", () => {
    const reduced = review.match(/@media \(prefers-reduced-motion: reduce\) \{[^@]*\.image-reveal[^}]*\}/)![0];
    expect(reduced).toContain(`animation: image-reveal-fade ${REVEAL_REDUCED_MS}ms linear both !important`);
    expect(review).toMatch(/@keyframes image-reveal-fade \{\s*from \{ opacity: 0; \}\s*to \{ opacity: 1; \}\s*\}/);
  });
});
