import { expect, it, vi } from "vitest";
import { retryAction } from "@/lib/retry-action";
import { plainError } from "@/lib/plain-error";

it("retries a plain failure and does not retry an uncertain outcome", () => {
  const action = vi.fn();
  if (plainError("Something failed").action === "Retry") retryAction(action);
  expect(action).toHaveBeenCalledOnce();
  if (plainError("Outcome uncertain; may have used credits").action === "Retry") retryAction(action);
  expect(action).toHaveBeenCalledOnce();
  expect(plainError("Outcome uncertain; may have used credits").action).toBe("My creations");
  expect(() => retryAction(null)).not.toThrow();
});

it("never offers a replay for paid actions, even after a definite failure", async () => {
  const { retryableAction, isPaidAction } = await import("@/lib/retry-action");
  const replay = vi.fn();
  for (const label of ["Generating 4 thumbnails", "Analyzing thumbnail", "Retrying score", "Applying one-click fix", "Applying reviewed fix", "Rearranging your thumbnail", "Improving your prompt", "Preparing fix plan", "Preparing reference profile"]) {
    expect(isPaidAction(label)).toBe(true);
    expect(retryableAction(label, replay, false)).toBeNull();
  }
  expect(retryableAction("Saving draft", replay, false)).toBe(replay);
  expect(retryableAction("Downloading image", replay, false)).toBe(replay);
  expect(retryableAction("Saving draft", replay, true)).toBeNull();
});
