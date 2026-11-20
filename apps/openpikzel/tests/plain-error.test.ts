import { describe, expect, it } from "vitest";
import { plainError } from "@/lib/plain-error";

describe("plainError", () => {
  it("offers connection for missing credentials", () => {
    expect(plainError("API key missing")).toEqual({ text: "Connect your AI key to continue.", action: "Connect" });
  });
  it("never exposes technical errors", () => {
    expect(plainError("Cannot read properties of undefined")).toEqual({ text: "Something went wrong. Please try again.", action: "Retry" });
  });
  it("offers retry after rate limiting", () => {
    expect(plainError("provider returned 429").action).toBe("Retry");
  });
});
