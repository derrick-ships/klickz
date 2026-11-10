import { describe, expect, it } from "vitest";
import { ANTHROPIC_VISION_MODEL, pickVisionProvider } from "../src/lib/vision-provider";

describe("pickVisionProvider", () => {
  it("returns anthropic when that key is present, even with openai", () => {
    expect(pickVisionProvider({ anthropic: "sk-ant-test-0000FAKE", openai: "sk-openai-test" })).toBe("anthropic");
  });
  it("returns openai when anthropic is missing and openai is present", () => {
    expect(pickVisionProvider({ openai: "sk-openai-test", google: "google-test" })).toBe("openai");
  });
  it("returns google when only google is present", () => {
    expect(pickVisionProvider({ google: "google-test" })).toBe("google");
  });
  it("returns null when no vision key is present", () => {
    expect(pickVisionProvider({})).toBe(null);
    expect(pickVisionProvider({ jev: "jev-test" })).toBe(null);
  });
  it("keeps the official Opus model id in one constant", () => {
    expect(ANTHROPIC_VISION_MODEL).toBe("claude-opus-5-5");
  });
});
