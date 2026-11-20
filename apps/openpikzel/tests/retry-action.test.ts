import { expect, it, vi } from "vitest";
import { retryAction } from "@/lib/retry-action";

it("runs the saved action, and tolerates an absent one", () => {
  const action = vi.fn();
  retryAction(action);
  expect(action).toHaveBeenCalledOnce();
  expect(() => retryAction(null)).not.toThrow();
});
