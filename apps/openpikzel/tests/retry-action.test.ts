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
