import { describe, it, expect, vi, beforeEach } from "vitest";
import { seal } from "../src/lib/crypto";
import {
  digest,
  enrichDiagnostic,
  compileFixPlan,
} from "../src/lib/diagnostics";
import { signDiagnostic } from "../src/lib/diagnostic-proof";
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
    withUserProviders: async (
      _request: Request,
      work: () => Promise<Response>,
    ) => {
      const { providerContext } = await import("../src/lib/provider-context");
      return providerContext.run({ openai: "test-placeholder" }, work);
    },
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
vi.mock("../src/lib/jobs", () => ({
  reserveJob: async () => ({ replay: null }),
  updateJob: async () => {},
  ambiguousProviderError: () => true,
}));
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
  vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64));
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
    expect(mock.updates.some((x) => x.status === "reconciling")).toBe(true);
  });
  it("fixes the source using the existing matching image-and-title critique", async () => {
    const base = {
      ...(mock.parent.score as Record<string, unknown>),
      source: "jev",
      version: 2,
      overall: 50,
      note: "fixture",
      priority: "clarity",
      created_at: new Date().toISOString(),
      dimensions: Object.fromEntries(
        pillars.map((p) => [
          p,
          {
            score: 50,
            confidence: 0.7,
            observation: "Competing text is visible",
            strength: "Visible subject",
            weakness: "Text competes",
            fix: "Shorten the competing text",
          },
        ]),
      ),
    } as any;
    const source = Buffer.from("reference");
    const score = signDiagnostic(
      enrichDiagnostic(
        base,
        source,
        "A specific video",
        {
          videoBrief: "The actual video shows a specific experiment.",
          audience: "",
          includeVision: true,
        },
        { width: 200, height: 113, digest: digest("preview") },
        true,
      ),
    );
    mock.parent.score = score;
    mock.parent.id = id;
    const compiled = compileFixPlan(
      score,
      id,
      digest(source),
      defaultSettings,
      { exactText: [], requiredObjects: [], forbiddenChanges: [] },
    );
    if (compiled.kind !== "ready") throw new Error("Fixture plan failed");
    const response = await POST(
      request({
        mode: "fix",
        parentId: id,
        fixPlanToken: seal(compiled.plan, "fix-plan"),
      }),
    );
    expect(response.status).toBe(200);
    expect(mock.evaluate).not.toHaveBeenCalled();
    expect(mock.render.mock.calls[0][0]).toContain(
      "Shorten the competing text",
    );
    expect(mock.render.mock.calls[0][1]).toHaveLength(1);
  });
});

it("carries the source conversation into an MCP-style edit without a new conversationId",async()=>{
 const id="33333333-3333-4333-8333-333333333333";
 mock.parent={...mock.parent,id:"22222222-2222-4222-8222-222222222222",user_id:"11111111-1111-4111-8111-111111111111",image_path:"11111111-1111-4111-8111-111111111111/source.png",conversation_id:id,title:"Original",prompt:"A factual image concept"};
 const {POST}=await import("../src/app/api/generate/route");
 mock.render.mockResolvedValue(Buffer.from("fixture-render"));
 const r=await POST(new Request("https://studio.example/api/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:"Edit the image with a clearer background",title:"Original",mode:"edit",parentId:mock.parent.id,requestId:crypto.randomUUID(),settings:defaultSettings})}));
 expect(r.status).toBe(200);expect(mock.reservations[0].conversation_id).toBe(id);
});

it("deduplicates the source path before reference dispatch and records recomposition provenance",async()=>{mock.parent.id=id;const r=await POST(request({mode:"edit",intent:"recompose",parentId:id,referencePaths:[id+"/original.png"],settings:{...defaultSettings,format:"short",batch:1}}));expect(r.status).toBe(200);expect(mock.render.mock.calls[0][1]).toHaveLength(1);expect(mock.reservations[0].lineage).toMatchObject({origin:"recomposed",nativeOutput:true,sourceId:id});});
