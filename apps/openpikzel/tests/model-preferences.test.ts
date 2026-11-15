import { it, expect, describe, beforeEach } from "vitest";
import { newestInFamily, resolveAlias, readModelPreferences, aliasById, clearModelCache, modelPreferencesSchema } from "../src/lib/model-preferences";
import { pickVisionProvider } from "../src/lib/vision-provider";
import { scorePlan } from "../src/lib/score-on-generate";

// Real OpenAI list (15 Nov 2026) — "latest" must pick the newest of each family.
const openai = ["gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol", "gpt-6.1-terra"];
const anthropic = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"];

describe("latest aliases", () => {
  beforeEach(() => clearModelCache());
  it("picks the newest model of each family", () => {
    expect(newestInFamily(openai, aliasById("gpt-sol-latest")!.family)).toBe("gpt-6.1-sol");
    expect(newestInFamily(openai, aliasById("gpt-terra-latest")!.family)).toBe("gpt-6.1-terra");
    expect(newestInFamily(openai, aliasById("gpt-luna-latest")!.family)).toBe("gpt-6-luna");
    expect(newestInFamily(anthropic, aliasById("opus-latest")!.family)).toBe("claude-opus-5-5");
    expect(newestInFamily(anthropic, aliasById("haiku-latest")!.family)).toBe("claude-haiku-5-5");
  });
  it("follows a new release without a code change, and falls back when the list can't be read", async () => {
    const alias = aliasById("gpt-sol-latest")!;
    expect((await resolveAlias(alias, "k1", async () => [...openai, "gpt-6.2-sol"])).model).toBe("gpt-6.2-sol");
    expect(await resolveAlias(alias, "k2", async () => { throw new Error("down"); })).toEqual({ model: alias.fallback, resolved: false });
  });
});

describe("saved preferences", () => {
  it("defaults safely and ignores junk", () => {
    expect(readModelPreferences(null)).toEqual({ reviewer: "auto", scorer: "jev", mediator: "auto", image: "flare" });
    expect(readModelPreferences({ openpikzels_models: { scorer: "nope" } }).scorer).toBe("jev");
    expect(modelPreferencesSchema.parse({ reviewer: "sonnet-latest", scorer: "model" })).toMatchObject({ reviewer: "sonnet-latest", scorer: "model" });
  });
  it("uses the chosen reviewer when its key is connected, otherwise the usual order", () => {
    expect(pickVisionProvider({ anthropic: "a", openai: "o" }, "openai")).toBe("openai");
    expect(pickVisionProvider({ anthropic: "a" }, "openai")).toBe("anthropic");
  });
  it("scores without Jev when the reviewer model is the scorer", () => {
    expect(scorePlan({ jev: false, openai: true, models: { reviewer: "gpt-sol-latest", scorer: "model" } })).toEqual({ review: true, includeVision: true, critiqueProvider: "openai" });
    expect(scorePlan({ jev: false, openai: true }).review).toBe(false);
  });
});
