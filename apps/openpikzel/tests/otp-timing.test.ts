import { afterEach, describe, expect, it, vi } from "vitest";
import { createOtpScheduler } from "../src/lib/otp-code";

afterEach(() => vi.useRealTimers());
describe("OTP submission timing", () => {
  it("submits eight typed digits immediately, cancelling the six-digit timer", () => {
    vi.useFakeTimers(); const submit = vi.fn(); const otp = createOtpScheduler(submit);
    otp.input("123456", false); vi.advanceTimersByTime(1499); expect(submit).not.toHaveBeenCalled();
    otp.input("12345678", false); expect(submit).toHaveBeenCalledOnce(); expect(submit).toHaveBeenCalledWith("12345678");
    vi.runAllTimers(); expect(submit).toHaveBeenCalledOnce();
  });
  it("never auto-submits six typed digits, even after a long pause", () => {
    vi.useFakeTimers(); const submit = vi.fn(); const otp = createOtpScheduler(submit);
    otp.input("123456", false); vi.advanceTimersByTime(10000); expect(submit).not.toHaveBeenCalled();
  });
  it.each(["12-34 56", "12-34 56 78"])("submits pasted digits immediately: %s", raw => {
    vi.useFakeTimers(); const submit = vi.fn(); const otp = createOtpScheduler(submit);
    otp.input(raw, true); expect(submit).toHaveBeenCalledOnce(); expect(submit).toHaveBeenCalledWith(raw.replace(/\D/g, "")); vi.runAllTimers(); expect(submit).toHaveBeenCalledOnce();
  });
});
