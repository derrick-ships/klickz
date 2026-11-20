import { describe, expect, it } from "vitest";
import { shouldDismiss } from "../src/lib/use-swipe-dismiss";
describe("swipe dismissal", () => {
  it("dismisses past 30% or above the velocity threshold", () => {
    expect(shouldDismiss(31, 100, 0)).toBe(true);
    expect(shouldDismiss(1, 100, 0.51)).toBe(true);
    expect(shouldDismiss(30, 100, 0.5)).toBe(false);
    expect(shouldDismiss(-50, 100, -1)).toBe(false);
  });
});
