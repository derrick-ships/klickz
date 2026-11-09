import { describe, expect, it } from "vitest";
import { takeSignInLinkError } from "../src/lib/sign-in-link";
describe("email-link recovery", () => {
  it("recognizes expired links and drops only error parameters", () => {
    const result = takeSignInLinkError("https://openpikzels.com/connect?view=keys#error=access_denied&error_code=otp_expired&error_description=untrusted");
    expect(result?.message).toContain("expired or was already used");
    expect(result?.cleanUrl).toBe("/connect?view=keys");
    expect(result?.message).not.toContain("untrusted");
  });
  it("handles invalid query callbacks without reflecting provider text", () => {
    const result = takeSignInLinkError("https://openpikzels.com/connect?error=bad&error_description=%3Cscript%3E");
    expect(result?.message).toContain("could not be verified");
    expect(result?.cleanUrl).toBe("/connect");
  });
  it("leaves successful implicit callbacks for the Supabase SDK", () => {
    expect(takeSignInLinkError("https://openpikzels.com/connect#access_token=fixture&refresh_token=fixture&type=magiclink")).toBeNull();
  });
  it("leaves Higgsfield OAuth state and errors untouched", () => {
    expect(takeSignInLinkError("https://openpikzels.com/connect?state=fixture&error=access_denied")).toBeNull();
  });
});
