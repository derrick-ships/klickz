import { providerContext } from "../src/lib/provider-context";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  renderThumbnail,
  resizeThumbnail,
  evaluateThumbnail,
  fixInstructions,
  prepareIdentity,
} from "../src/lib/providers";
import { defaultSettings, pillars, type Evaluation } from "../src/lib/types";
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
async function sample() {
  return sharp({
    create: { width: 1280, height: 720, channels: 3, background: "#ff3b43" },
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
        const b = await sample();
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
        expect([meta.width, meta.height]).toEqual([720, 1280]);
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
    const image = await sample(),
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
    expect((await sharp(result).metadata()).height).toBe(1280);
  }));

it("recomposes the source through image editing and returns a real 9:16 output",async()=>providerContext.run({openai:"fixture-key"},async()=>{
 const original=await sample(),copy=Buffer.from(original);
 const fetcher=vi.fn().mockImplementation(async()=>response({data:[{b64_json:original.toString("base64")}]}));vi.stubGlobal("fetch",fetcher);
 const {recomposePrompt}=await import("../src/lib/analysis-display");
 const result=await renderThumbnail(recomposePrompt("short"),[original],{...defaultSettings,format:"short",quality:"low",batch:1});
 const metadata=await sharp(result).metadata();expect([metadata.width,metadata.height]).toEqual([720,1280]);
 const edits=fetcher.mock.calls.filter(([url])=>String(url).includes("/images/edits"));expect(edits).toHaveLength(1);expect(original.equals(copy)).toBe(true);
}));
