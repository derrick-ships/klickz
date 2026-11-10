import { providerContext } from "../src/lib/provider-context";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  renderThumbnail,
  resizeThumbnail,
  evaluateThumbnail,
  observePackaging,
  fixInstructions,
  prepareIdentity,
} from "../src/lib/providers";
import { defaultSettings, pillars, type Evaluation } from "../src/lib/types";
import { AppError } from "../src/lib/validation";
import { ANTHROPIC_VISION_MODEL } from "../src/lib/vision-provider";
import sharp from "sharp";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
const textResponse = (value: unknown) =>
  response({
    object: "response",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: typeof value === "string" ? value : JSON.stringify(value),
            annotations: [],
          },
        ],
      },
    ],
  });
async function sample(format:"long"|"short"="long") {
  return sharp({
    create: { width: format==="short"?864:1280, height: format==="short"?1536:720, channels: 3, background: "#ff3b43" },
  })
    .png()
    .toBuffer();
}
describe("OpenPikzel provider contracts; no paid traffic", () => {
  it("forwards Sunburst, Max quality, planning and portrait size", async () =>
    providerContext.run(
      { openai: "test-placeholder", jev: "test-placeholder" },
      async () => {
        vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
        const b = await sample("short");
        const fetcher = vi
          .fn()
          .mockImplementation(async () =>
            response({ data: [{ b64_json: b.toString("base64") }] }),
          );
        vi.stubGlobal("fetch", fetcher);
        const image = await renderThumbnail("A title-based cover", [], {
          ...defaultSettings,
          model: "sunburst",
          quality: "max",
          complexity: "high",
          format: "short",
        });
        const [url, request] = fetcher.mock.calls[0];
        const body = JSON.parse(request.body);
        expect(String(url)).toContain("/images/generations");
        expect(body).toMatchObject({
          model: "gpt-image-2.6-sunburst",
          quality: "max",
          complexity: "high",
          size: "864x1536",
        });
        const meta = await sharp(image).metadata();
        expect([meta.width, meta.height]).toEqual([864, 1536]);
      },
    ));
  it("uses the edit endpoint when reference pictures are supplied", async () =>
    providerContext.run(
      { openai: "test-placeholder", jev: "test-placeholder" },
      async () => {
        vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
        const b = await sample();
        const fetcher = vi
          .fn()
          .mockImplementation(async () =>
            response({ data: [{ b64_json: b.toString("base64") }] }),
          );
        vi.stubGlobal("fetch", fetcher);
        await renderThumbnail("Recreate with the same persona", [b]);
        expect(
          fetcher.mock.calls.some((call) =>
            String(call[0]).includes("/images/edits"),
          ),
        ).toBe(true);
      },
    ));
  it("sends the actual image and title to Jev across five rubric questions", async () =>
    providerContext.run(
      { openai: "test-placeholder", jev: "test-placeholder" },
      async () => {
        vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
        vi.stubEnv("JEV_API_KEY", "test-placeholder");
        const observations = {
          summary: "Red focal scene",
          dimensions: Object.fromEntries(
            pillars.map((p) => [
              p,
              {
                observation: "A clear focal subject",
                strength: "Subject is visible",
                weakness: "Text competes",
                fix: "Shorten the text",
              },
            ]),
          ),
        };
        const fetcher = vi
          .fn()
          .mockResolvedValueOnce(textResponse(observations))
          .mockResolvedValueOnce(
            response({
              answers: Object.fromEntries(
                pillars.map((p) => [p, { score: 1.5, confidence: 0.6 }]),
              ),
            }),
          );
        vi.stubGlobal("fetch", fetcher);
        const score = await evaluateThumbnail(
          await sample(),
          "A real video title",
          "request-id",
          {
            videoBrief: "The video shows a real experiment",
            audience: "",
            includeVision: true,
          },
        );
        expect(score.overall).toBe(50);
        const [url, request] = fetcher.mock.calls[1];
        expect(url).toBe("https://api.typesafe.ai/v1/systemone");
        expect(request.headers["TypeSafe-Danger-Zone-Images"]).toBe("true");
        const body = JSON.parse(request.body);
        expect(Object.keys(body.questions)).toEqual(pillars);
        expect(body.state.title).toBe("A real video title");
        expect(body.state.visualGuidance.clarity.observation).toBe("A clear focal subject");
        expect(score.contributors?.map(c=>c.provider)).toEqual(["Jev","OpenAI API"]);
        expect(
          body.assets[body.state.thumbnail].data_base64.length,
        ).toBeGreaterThan(100);
        expect(score.dimensions.clarity.fix).toBe("Shorten the text");
      },
    ));
  it("resizes instantly without any API call and preserves both output formats", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const format of ["long", "short"] as const) {
      const resized = await resizeThumbnail(await sample(), format);
      const m = await sharp(resized).metadata();
      expect([m.width, m.height]).toEqual(
        format === "long" ? [1280, 720] : [720, 1280],
      );
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("prepares an identity brief from reference images without claiming fine tuning", async () =>
    providerContext.run(
      { openai: "test-placeholder", jev: "test-placeholder" },
      async () => {
        vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
        vi.stubGlobal(
          "fetch",
          vi
            .fn()
            .mockResolvedValue(
              textResponse("Preserve the distinctive glasses and hairstyle."),
            ),
        );
        expect(
          await prepareIdentity([await sample()], "Derrick", "persona"),
        ).toContain("glasses");
      },
    ));
});

it("scores with Jev alone without silently charging an image or text provider", async () =>
  providerContext.run({ jev: "test-jev-placeholder" }, async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        answers: Object.fromEntries(
          pillars.map((p) => [p, { score: 2, confidence: 0.7 }]),
        ),
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const value = await evaluateThumbnail(
      await sample(),
      "An actual video title",
      "jev-only-test",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("typesafe.ai");
    expect(value.dimensions.clarity.weakness).toContain("numeric rubric");
  }));
it("routes Google image requests to the user key with native aspect ratio and fixed 1K output", async () =>
  providerContext.run({ google: "google-test-placeholder" }, async () => {
    const image = await sharp({create:{width:768,height:1376,channels:3,background:"red"}}).png().toBuffer(),
      fetcher = vi.fn().mockResolvedValue(
        response({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: image.toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await renderThumbnail("Create a clear thumbnail", [], {
      ...defaultSettings,
      model: "gemini-flash",
      format: "short",
    });
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
    );
    expect(request.headers["x-goog-api-key"]).toBe("google-test-placeholder");
    expect(
      JSON.parse(request.body).generationConfig.responseFormat.image,
    ).toEqual({ aspectRatio: "9:16", imageSize: "1K" });
    expect((await sharp(result).metadata()).height).toBe(1376);
  }));

it("recomposes the source through image editing and returns a real 9:16 output",async()=>providerContext.run({openai:"fixture-key"},async()=>{
 const original=await sample(),copy=Buffer.from(original),portrait=await sample("short");
 const fetcher=vi.fn().mockImplementation(async()=>response({data:[{b64_json:portrait.toString("base64")}]}));vi.stubGlobal("fetch",fetcher);
 const {recomposePrompt}=await import("../src/lib/analysis-display");
 const result=await renderThumbnail(recomposePrompt("short"),[original],{...defaultSettings,format:"short",quality:"low",batch:1});
 const metadata=await sharp(result).metadata();expect([metadata.width,metadata.height]).toEqual([864,1536]);
 const edits=fetcher.mock.calls.filter(([url])=>String(url).includes("/images/edits"));expect(edits).toHaveLength(1);expect(original.equals(copy)).toBe(true);
}));

it("preserves all pixels when a provider returns an unexpected aspect ratio",async()=>providerContext.run({openai:"fixture-key"},async()=>{
 const native=await sample(),fetcher=vi.fn().mockResolvedValue(response({data:[{b64_json:native.toString("base64")}]}));vi.stubGlobal("fetch",fetcher);
 const result=await renderThumbnail("Recompose to portrait without losing source",[],{...defaultSettings,format:"short"});const metadata=await sharp(result).metadata();expect([metadata.width,metadata.height]).toEqual([1280,720]);expect((await sharp(result).raw().toBuffer()).equals(await sharp(native).raw().toBuffer())).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);
}));
it("forwards all supported Google references instead of silently truncating them",async()=>providerContext.run({google:"fixture-key"},async()=>{
 const native=await sample(),fetcher=vi.fn().mockResolvedValue(response({candidates:[{content:{parts:[{inlineData:{mimeType:"image/png",data:native.toString("base64")}}]}}]}));vi.stubGlobal("fetch",fetcher);
 await renderThumbnail("Keep every selected reference",Array.from({length:12},()=>native),{...defaultSettings,model:"gemini-pro"});const body=JSON.parse(fetcher.mock.calls[0][1].body);expect(body.contents[0].parts.filter((part:any)=>part.inlineData)).toHaveLength(12);
}));

it("rejects unsupported reference counts before making a provider request",async()=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);const bytes=await sample();for(const [provider,model,count]of [["google","gemini-flash",15],["openai","flare",17]]as const)await providerContext.run({[provider]:"fixture-key"},async()=>{await expect(renderThumbnail("Keep the selected references",Array.from({length:count},()=>bytes),{...defaultSettings,model})).rejects.toThrow(/at most/);});expect(fetcher).not.toHaveBeenCalled();
});
it("reports native rounded ratios without hiding a genuinely different output",async()=>{const {nativeAspectMatches}=await import("../src/lib/image-output");expect(nativeAspectMatches(768,1376,"short")).toBe(true);expect(nativeAspectMatches(864,1536,"short")).toBe(true);expect(nativeAspectMatches(1280,720,"short")).toBe(false);});

const fixtureAnthropicKey = "sk-ant-test-0000FAKE";
const visionObservations = {
  summary: "Red focal scene",
  dimensions: Object.fromEntries(
    pillars.map((p) => [
      p,
      {
        observation: "A clear focal subject",
        strength: "Subject is visible",
        weakness: "Text competes",
        fix: "Shorten the text",
      },
    ]),
  ),
};
const anthropicResponse = (value: unknown) =>
  response({ content: [{ type: "text", text: JSON.stringify(value) }] });
const captureLogs = () => {
  const logs: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((name) =>
    vi.spyOn(console, name).mockImplementation((...args) => {
      logs.push(args.map(String).join(" "));
    }),
  );
  return { logs, restore: () => spies.forEach((spy) => spy.mockRestore()) };
};

it("sends a Claude Messages request from the user key, with an image block and no leaked secret", async () =>
  providerContext.run(
    { anthropic: fixtureAnthropicKey, openai: "openai-should-not-be-used", jev: "jev-fixture" },
    async () => {
      const { logs, restore } = captureLogs();
      try {
        const fetcher = vi
          .fn()
          .mockResolvedValueOnce(anthropicResponse(visionObservations))
          .mockResolvedValueOnce(
            response({
              answers: Object.fromEntries(
                pillars.map((p) => [p, { score: 1.5, confidence: 0.6 }]),
              ),
            }),
          );
        vi.stubGlobal("fetch", fetcher);
        const score = await evaluateThumbnail(
          await sample(),
          "A real video title",
          "request-id",
          {
            videoBrief: "The video shows a real experiment",
            audience: "",
            includeVision: true,
            critiqueProvider: "anthropic",
          },
        );
        const [url, request] = fetcher.mock.calls[0];
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(request.headers["x-api-key"]).toBe(fixtureAnthropicKey);
        expect(request.headers["anthropic-version"]).toBeDefined();
        const body = JSON.parse(request.body);
        expect(body.model).toBe(ANTHROPIC_VISION_MODEL);
        expect(body.max_tokens).toBe(16000);
        expect(
          body.messages[0].content.some(
            (block: { type: string; source?: { type: string; data?: string } }) =>
              block.type === "image" && block.source?.type === "base64" && block.source.data,
          ),
        ).toBe(true);
        expect(score.contributors?.map((c) => c.provider)).toEqual(["Jev", "Anthropic API"]);
        expect(score.contributors?.find((c) => c.role === "image-review")?.model).toBe(
          ANTHROPIC_VISION_MODEL,
        );
        expect(JSON.stringify(score)).not.toContain(fixtureAnthropicKey);
        expect(logs.join("\n")).not.toContain(fixtureAnthropicKey);
        expect(
          fetcher.mock.calls.every(
            ([u]) =>
              !String(u).includes("api.openai.com") &&
              !String(u).includes("generativelanguage.googleapis.com"),
          ),
        ).toBe(true);
      } finally {
        restore();
      }
    },
  ));

it("uses ANTHROPIC_VISION_MODEL when set, otherwise the official Opus constant", async () =>
  providerContext.run({ anthropic: fixtureAnthropicKey }, async () => {
    vi.stubEnv("ANTHROPIC_VISION_MODEL", "claude-opus-test-override");
    const fetcher = vi.fn().mockResolvedValue(anthropicResponse(visionObservations));
    vi.stubGlobal("fetch", fetcher);
    await observePackaging(await sample(), "A real video title", "", undefined, "anthropic");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe("claude-opus-test-override");
  }));

it("returns a generic AppError when Claude fails and does not call another vision provider", async () =>
  providerContext.run(
    {
      anthropic: fixtureAnthropicKey,
      openai: "openai-should-not-be-used",
      google: "google-should-not-be-used",
      jev: "jev-fixture",
    },
    async () => {
      const { logs, restore } = captureLogs();
      try {
        const fetcher = vi
          .fn()
          .mockResolvedValue(new Response("upstream " + fixtureAnthropicKey, { status: 500 }));
        vi.stubGlobal("fetch", fetcher);
        const error = await observePackaging(
          await sample(),
          "A real video title",
          "",
          undefined,
          "anthropic",
        ).then(
          () => undefined,
          (e) => e,
        );
        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe("Image review did not finish");
        expect(String(error)).not.toContain(fixtureAnthropicKey);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(String(fetcher.mock.calls[0][0])).toBe("https://api.anthropic.com/v1/messages");
        expect(logs.join("\n")).not.toContain(fixtureAnthropicKey);
      } finally {
        restore();
      }
    },
  ));

it("parses a fenced JSON Claude reply", async () =>
  providerContext.run({ anthropic: fixtureAnthropicKey }, async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: "```json\n" + JSON.stringify(visionObservations) + "\n```",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      observePackaging(await sample(), "A real video title", "", undefined, "anthropic"),
    ).resolves.toMatchObject({ summary: "Red focal scene" });
  }));

it("skips thinking blocks and reads the first text block", async () =>
  providerContext.run({ anthropic: fixtureAnthropicKey }, async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "internal notes, not JSON" },
          { type: "text", text: JSON.stringify(visionObservations) },
          { type: "text", text: "```this later block must be ignored```" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      observePackaging(await sample(), "A real video title", "", undefined, "anthropic"),
    ).resolves.toMatchObject({ summary: "Red focal scene" });
  }));

it("treats stop_reason max_tokens as a generic review failure and does not fall back", async () =>
  providerContext.run(
    {
      anthropic: fixtureAnthropicKey,
      openai: "openai-should-not-be-used",
      google: "google-should-not-be-used",
    },
    async () => {
      const fetcher = vi.fn().mockResolvedValue(
        response({
          stop_reason: "max_tokens",
          content: [{ type: "text", text: JSON.stringify(visionObservations) }],
        }),
      );
      vi.stubGlobal("fetch", fetcher);
      const error = await observePackaging(
        await sample(),
        "A real video title",
        "",
        undefined,
        "anthropic",
      ).then(
        () => undefined,
        (e) => e,
      );
      expect(error).toBeInstanceOf(AppError);
      expect(error.status).toBe(502);
      expect(error.message).toBe("Image review did not finish");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(String(fetcher.mock.calls[0][0])).toBe("https://api.anthropic.com/v1/messages");
      expect(
        fetcher.mock.calls.every(
          ([u]) =>
            !String(u).includes("api.openai.com") &&
            !String(u).includes("generativelanguage.googleapis.com"),
        ),
      ).toBe(true);
    },
  ));
