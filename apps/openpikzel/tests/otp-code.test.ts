import { describe, expect, it } from "vitest";
import { normalizeOtpCode } from "../src/lib/otp-code";

describe("normalizeOtpCode", () => {
  it("removes spaces and dashes from six and eight digit codes", () => {
    expect(normalizeOtpCode("123-456")).toBe("123456");
    expect(normalizeOtpCode("12 34-56 78")).toBe("12345678");
  });
  it("does not turn unrelated text into a valid code", () => {
    expect(normalizeOtpCode("code 123456")).toBe("code123456");
  });
});
