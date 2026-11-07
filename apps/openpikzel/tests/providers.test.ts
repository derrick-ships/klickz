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
  it("forwards Sunburst, Max quality, planning and portrait size", async () => {
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
  });
  it("uses the edit endpoint when reference pictures are supplied", async () => {
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
  });
  it("sends the actual image and title to Jev across five rubric questions", async () => {
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
    );
    expect(score.overall).toBe(50);
    const [url, request] = fetcher.mock.calls[1];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(request.headers["TypeSafe-Danger-Zone-Images"]).toBe("true");
    const body = JSON.parse(request.body);
    expect(Object.keys(body.questions)).toEqual(pillars);
    expect(body.state.title).toBe("A real video title");
    expect(
      body.assets[body.state.thumbnail].data_base64.length,
    ).toBeGreaterThan(100);
    expect(score.dimensions.clarity.fix).toBe("Shorten the text");
  });
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
  it("prepares an identity brief from reference images without claiming fine tuning", async () => {
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
  });
});
