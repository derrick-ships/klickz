import { describe, it, expect, vi, beforeEach } from "vitest";
import { defaultSettings, pillars } from "../src/lib/types";
const mock = vi.hoisted(() => ({
  duplicate: false,
  reservations: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  render: vi.fn(),
  evaluate: vi.fn(),
  parent: {} as Record<string, unknown>,
}));
vi.mock("../src/lib/server", async () => {
  const actual =
    await vi.importActual<typeof import("../src/lib/server")>(
      "../src/lib/server",
    );
  return {
    ...actual,
    requireAI: vi.fn(),
    authenticated: async () => ({
      user: { id: "11111111-1111-4111-8111-111111111111" },
      db: {
        from: () => {
          let operation = "read",
            rows: Record<string, unknown>[] = [];
          let update: Record<string, unknown> = {},
            id = "";
          const chain: { [key: string]: unknown } = {
            select: () => chain,
            eq: (key: string, value: string) => {
              if (key === "id") id = value;
              return chain;
            },
            maybeSingle: async () => ({
              data: mock.duplicate ? { id: "existing" } : null,
              error: null,
            }),
            single: async () => ({
              data: operation === "update" ? { ...update, id } : mock.parent,
              error: null,
            }),
            insert: (value: Record<string, unknown>[]) => {
              operation = "insert";
              rows = value;
              mock.reservations = value;
              return chain;
            },
            update: (value: Record<string, unknown>) => {
              operation = "update";
              update = value;
              mock.updates.push(value);
              return chain;
            },
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(
                operation === "insert"
                  ? {
                      data: rows.map((r, i) => ({
                        id: `render-${i}`,
                        batch_index: i,
                      })),
                      error: null,
                    }
                  : { data: null, error: null },
              ).then(resolve),
          };
          return chain;
        },
        storage: { from: () => ({ upload: async () => ({ error: null }) }) },
      },
    }),
  };
});
vi.mock("../src/lib/providers", () => ({
  renderThumbnail: mock.render,
  evaluateThumbnail: mock.evaluate,
  fixInstructions: () => "clarity: Shorten the competing text",
}));
vi.mock("../src/lib/assets", () => ({
  ownedAsset: async () => Buffer.from("reference"),
}));
import { POST } from "../src/app/api/generate/route";
const id = "11111111-1111-4111-8111-111111111111";
const request = (data: Record<string, unknown>) =>
  new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "A specific thumbnail concept",
      title: "A specific video",
      mode: "generate",
      requestId: id,
      ...data,
    }),
  });
beforeEach(() => {
  mock.duplicate = false;
  mock.reservations = [];
  mock.updates = [];
  mock.render.mockReset().mockResolvedValue(Buffer.from("png"));
  mock.evaluate.mockReset();
  mock.parent = {
    id: "parent",
    image_path: id + "/original.png",
    title: "A specific video",
    score: {
      version: 2,
      title: "A specific video",
      dimensions: Object.fromEntries(
        pillars.map((p) => [p, { score: 50, fix: "Shorten text" }]),
      ),
    },
  };
});
describe("generation orchestration without provider traffic", () => {
  it("atomically reserves a batch and forwards all settings to every variation", async () => {
    const response = await POST(
      request({
        settings: {
          ...defaultSettings,
          batch: 4,
          model: "sunburst",
          quality: "max",
          format: "short",
        },
      }),
    );
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(mock.reservations).toHaveLength(4);
    expect(mock.render).toHaveBeenCalledTimes(4);
    expect(result.creations).toHaveLength(4);
    expect(
      mock.render.mock.calls.every(
        (c) => c[2].model === "sunburst" && c[2].format === "short",
      ),
    ).toBe(true);
  });
  it("prevents repeated request identifiers from making a billable call", async () => {
    mock.duplicate = true;
    const response = await POST(request({}));
    expect(response.status).toBe(409);
    expect(mock.render).not.toHaveBeenCalled();
  });
  it("keeps successful variations and does not retry an ambiguous failed render", async () => {
    mock.render
      .mockReset()
      .mockResolvedValueOnce(Buffer.from("png"))
      .mockRejectedValueOnce(new Error("provider timeout"))
      .mockResolvedValue(Buffer.from("png"));
    const response = await POST(
      request({ settings: { ...defaultSettings, batch: 4 } }),
    );
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.partial).toBe(true);
    expect(result.creations).toHaveLength(3);
    expect(mock.render).toHaveBeenCalledTimes(4);
    expect(mock.updates.some((x) => x.status === "failed")).toBe(true);
  });
  it("fixes the source using the existing matching image-and-title critique", async () => {
    const response = await POST(request({ mode: "fix", parentId: id }));
    expect(response.status).toBe(200);
    expect(mock.evaluate).not.toHaveBeenCalled();
    expect(mock.render.mock.calls[0][0]).toContain(
      "Shorten the competing text",
    );
    expect(mock.render.mock.calls[0][1]).toHaveLength(1);
  });
});
