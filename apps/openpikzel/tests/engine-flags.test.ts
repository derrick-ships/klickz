import { it, expect, vi, afterEach } from "vitest";
import sharp from "sharp";
import { observationSchema, observationJsonSchema } from "../src/lib/validation";
import { observePackaging } from "../src/lib/providers";
import { providerContext } from "../src/lib/provider-context";
import { pillars } from "../src/lib/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const review = (over: Record<string, unknown> = {}) => ({
  summary: "Face left, two-line question on the right",
  promiseConflict: false,
  readableText: "¿SE LE VOLTEARON?",
  dimensions: Object.fromEntries(
    pillars.map((p) => [p, { observation: "o", strength: "s", weakness: "w", fix: "old fix", flags: [], suggestions: [] }]),
  ),
  globalFlags: [],
  suggestion: "Make the face 30% larger. Keep the text ¿SE LE VOLTEARON? and the teal background.",
  keep: ["the man's face on the left"],
  keepText: ["¿SE LE VOLTEARON?"],
  ...over,
});

it("parses per-pillar flags and suggestions and drops unknown flags", () => {
  const raw = review();
  (raw.dimensions as any).clarity = {
    observation: "o", strength: "s", weakness: "Text is small", fix: "",
    flags: ["tiny_text", "made_up_flag", "tiny_text", "spoiler_present"],
    suggestions: ["Make the text twice as large", "Thicken the outline", "Drop the second line", "fourth is dropped"],
  };
  (raw as any).globalFlags = ["logo_or_date_present", "not_a_flag"];
  const parsed = observationSchema.parse(raw);
  // Only clarity's own vocabulary survives; duplicates collapse; foreign-pillar flags are dropped.
  expect(parsed.dimensions.clarity.flags).toEqual(["tiny_text"]);
  expect(parsed.dimensions.clarity.suggestions).toHaveLength(3);
  expect(parsed.dimensions.clarity.fix).toBe("Make the text twice as large");
  expect(parsed.dimensions.idea.fix).toBe("old fix");
  expect(parsed.globalFlags).toEqual(["logo_or_date_present"]);
  expect(parsed.keepText).toEqual(["¿SE LE VOLTEARON?"]);
});

it("accepts an older review without flags and clips the suggestion to 300 chars", () => {
  const legacy = { summary: "x", dimensions: Object.fromEntries(pillars.map((p) => [p, { observation: "o", strength: "s", weakness: "w", fix: "f" }])) };
  const parsed = observationSchema.parse({ ...legacy, suggestion: "a".repeat(500) });
  expect(parsed.dimensions.emotion.flags).toEqual([]);
  expect(parsed.suggestion).toHaveLength(300);
  expect(parsed.keep).toEqual([]);
});

it("the strict JSON schema requires every key and enumerates the flag vocabulary", () => {
  const s = observationJsonSchema as any;
  expect(s.additionalProperties).toBe(false);
  expect(s.required).toEqual(expect.arrayContaining(["suggestion", "keep", "keepText", "globalFlags", "dimensions"]));
  expect(s.properties.dimensions.properties.idea.properties.flags.items.enum).toContain("text_repeats_title");
  for (const p of pillars) expect(s.properties.dimensions.properties[p].required).toEqual(Object.keys(s.properties.dimensions.properties[p].properties));
});

const openaiResponse = (value: unknown) =>
  new Response(JSON.stringify({ object: "response", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value), annotations: [] }] }] }), { headers: { "content-type": "application/json" } });

it("calls OpenAI with Structured Outputs, no temperature for reasoning models, and passes fix history", async () =>
  providerContext.run({ openai: "fixture" }, async () => {
    const image = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#123456" } }).png().toBuffer();
    const fetcher = vi.fn().mockImplementation(async () => openaiResponse(review()));
    vi.stubGlobal("fetch", fetcher);
    const history = [{ suggestion: "Make the face larger", before: 60, after: 68 }];
    const result = await observePackaging(image, "Petro PERDIÓ el control", "", undefined, "openai", history);
    expect(result.suggestion).toContain("Keep the text");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true, name: "thumbnail_review" });
    expect(body).not.toHaveProperty("temperature");
    const data = body.input[0].content[0].text as string;
    expect(data).toContain("Make the face larger");
    expect(data).toContain("never recommend undoing a fix whose score did not drop");
  }));

it("sends temperature only to gpt-4 models", async () =>
  providerContext.run({ openai: "fixture" }, async () => {
    vi.stubEnv("OPENAI_TEXT_MODEL", "gpt-4.1");
    const image = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#123456" } }).png().toBuffer();
    const fetcher = vi.fn().mockImplementation(async () => openaiResponse(review()));
    vi.stubGlobal("fetch", fetcher);
    await observePackaging(image, "T", "", undefined, "openai");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).temperature).toBe(0);
  }));

it("validates a Claude reply against the same schema (unknown flags dropped)", async () =>
  providerContext.run({ anthropic: "sk-ant-fixture" }, async () => {
    const raw = review();
    (raw.dimensions as any).idea.flags = ["text_repeats_title", "bogus"];
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(raw) }] })));
    vi.stubGlobal("fetch", fetcher);
    const image = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#123456" } }).png().toBuffer();
    const result = await observePackaging(image, "T", "", undefined, "anthropic");
    expect(result.dimensions.idea.flags).toEqual(["text_repeats_title"]);
  }));
