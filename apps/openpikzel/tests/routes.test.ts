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
  profiles:{} as Record<string,any>,
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
        from: (table:string) => {
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
              data: operation === "update" ? { ...update, id } : (mock.profiles[table]===undefined?mock.parent:mock.profiles[table]),
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
// The mediator is a model call; here it returns a deterministic enriched prompt that
// quotes the request so the existing assertions about fix text still hold.
vi.mock("../src/lib/mediator", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/mediator")>("../src/lib/mediator");
  return {
    ...actual,
    mediate: vi.fn(async (input: { rawPrompt: string; format: "long" | "short" }) => ({
      substantial: actual.extractSubstantial(input.rawPrompt, input.format),
      provider: "Fixture mediator",
      model: "fixture",
      attempts: 1,
      enriched: {
        concept: "Fixture concept",
        lever: "INTRIGA",
        imageText: ["NO CUADRA"],
        panels: 1,
        prompt: "ENRICHED PROMPT. Brief: " + input.rawPrompt + ". Hook top-left: the face; proof bottom-right: the document. One large face on the left third, two-line condensed text on the right, high contrast, rim light, documentary teal/orange background.",
        dos: [{ rule: "One focal point", source: "02-visual-rules-dos-donts" }, { rule: "2-4 words", source: "00-README-cheat-sheet" }, { rule: "Text in negative space", source: "02-visual-rules-dos-donts" }, { rule: "High contrast", source: "02-visual-rules-dos-donts" }],
        donts: [{ rule: "No date", source: "03-house-style-prompt-template" }, { rule: "No logo", source: "03-house-style-prompt-template" }, { rule: "No thin fonts", source: "02-visual-rules-dos-donts" }, { rule: "No repeated title", source: "01-principles" }],
        substantialChanges: [],
        decisions: ["Chose the on-image text.", "Twist: what the title doesn't say; most intense colour on it."],
      },
    })),
  };
});
import { POST } from "../src/app/api/generate/route";
import { mediate } from "../src/lib/mediator";
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
  mock.duplicate = false;mock.profiles={};
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
  it("keeps composition examples out of the renderer for the bee regression", async () => {
    vi.mocked(mediate).mockClear();
    const response = await POST(request({ prompt: "subject getting chased by a big bee", title: "", libraryStyleId: "contrast-environment", settings: { ...defaultSettings, batch: 1 } }));
    expect(response.status).toBe(200);
    const input = vi.mocked(mediate).mock.calls[0][0];
    expect(input.chosenStyle).toMatchObject({ name: "Contrast Environment", mode: "composition", text: "none", exampleImages: [1, 2] });
    expect(input.referenceImages).toHaveLength(2);
    expect(input.notes.join(" ")).toContain("mediator only");
    expect(mock.render.mock.calls[0][1]).toHaveLength(0);
    expect(mock.render.mock.calls[0][0]).not.toContain("mediator only");
  });
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


it("never sends the user's raw prompt to the image model and stores the enriched prompt for inspection", async () => {
  const { mediate } = await import("../src/lib/mediator");
  const raw = "make a thumbnail about the land agency payments";
  mock.render.mockReset().mockResolvedValue(Buffer.from("png"));
  const r = await POST(request({ prompt: raw }));
  expect(r.status).toBe(200);
  expect(mediate).toHaveBeenCalled();
  const sent = mock.render.mock.calls[0][0] as string;
  expect(sent).not.toBe(raw);
  expect(sent.startsWith("ENRICHED PROMPT.")).toBe(true);
  expect(sent).toContain("DO:\n- One focal point");
  expect(sent).toContain("DON'T:\n- No date");
  const recorded = mock.updates.find((u) => (u.lineage as { mediator?: unknown } | undefined)?.mediator) as { lineage: { mediator: { rawPrompt: string; imagePrompt: string; principleFiles: string[] } } };
  expect(recorded.lineage.mediator.rawPrompt).toBe(raw);
  expect(recorded.lineage.mediator.imagePrompt).toBe(sent);
  expect(recorded.lineage.mediator.principleFiles).toHaveLength(12);
});

it("does not render anything when the mediator fails", async () => {
  const { mediate } = await import("../src/lib/mediator");
  vi.mocked(mediate).mockRejectedValueOnce(new Error("mediator unavailable"));
  mock.render.mockReset().mockResolvedValue(Buffer.from("png"));
  const r = await POST(request({}));
  expect(r.status).toBeGreaterThanOrEqual(400);
  expect(mock.render).not.toHaveBeenCalled();
});

it("puts every mentioned persona's photos first, two each, with one identity block per person", async () => {
  mock.render.mockReset().mockResolvedValue(Buffer.from("png"));
  const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", b = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
  let n = 0;
  Object.defineProperty(mock, "parent", { configurable: true, get: () => { n++; return { id: "p" + n, name: "Persona " + n, notes: "", refs: [1, 2, 3].map((i) => id + "/p" + n + "-" + i + ".png") }; }, set: (v) => { Object.defineProperty(mock, "parent", { value: v, writable: true, configurable: true, enumerable: true }); } });
  const r = await POST(request({ personaIds: [a, b] }));
  expect(r.status).toBe(200);
  const [prompt, refs] = mock.render.mock.calls[0] as [string, Buffer[]];
  expect(refs.length).toBeLessThanOrEqual(4);
  expect(prompt.match(/IDENTITY \(highest priority\)/g)).toHaveLength(2);
  expect(prompt).toContain("2 named people");
  expect(mock.reservations[0]).toMatchObject({ persona_id: a, lineage: { personaIds: [a, b] } });
});

it("rejects more than three personas", async () => {
  const ids = ["1", "2", "3", "4"].map((n) => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa" + n);
  const r = await POST(request({ personaIds: ids }));
  expect(r.status).toBe(400);
  expect(mock.render).not.toHaveBeenCalled();
});


it("orders persona, element and style attachments and records element lineage",async()=>{
 const elementId="33333333-3333-4333-8333-333333333333";
 mock.profiles={studio_personas:{name:"Derrick",refs:[id+"/face1",id+"/face2"],notes:""},studio_elements:{name:"Acme",kind:"logo",refs:[id+"/logo1",id+"/logo2"],notes:"Copy print"},studio_styles:{name:"Editorial",refs:[id+"/style"],notes:""}};
 const response=await POST(request({personaIds:[id],elementIds:[elementId],styleId:id}));expect(response.status).toBe(200);
 const {mediate}=await import('../src/lib/mediator');const input=vi.mocked(mediate).mock.calls.at(-1)![0];
 expect(input.attachments?.map(a=>a.role)).toEqual(["persona","element","style"]);
 expect(input.attachments?.[1]).toEqual({role:"element",kind:"logo",name:"Acme",images:[3,4]});
 expect(input.notes.join(' ')).toContain('ELEMENT (logo) "Acme"');expect((mock.reservations[0].lineage as any).elementIds).toEqual([elementId]);
});
it("returns 404 for an element outside the owned query",async()=>{mock.profiles.studio_elements=null;expect((await POST(request({elementIds:[id]}))).status).toBe(404);});
it("reduces element photos before rejecting an over-budget reference request",async()=>{
 mock.profiles.studio_elements={name:"Acme",kind:"logo",refs:[id+"/a",id+"/b",id+"/c"],notes:""};
 mock.profiles.studio_personas={name:"Person",refs:[id+"/p1",id+"/p2"],notes:""};
 mock.profiles.studio_styles={name:"Look",refs:[id+"/s1",id+"/s2",id+"/s3"],notes:""};
 const {imageModels}=await import("../src/lib/image-models");const model=imageModels.find(m=>m.id==="gemini-flash")!;const previous=model.maxReferences;model.maxReferences=5;
 const response=await POST(request({elementIds:[id],styleId:id,referencePaths:Array.from({length:6},(_,i)=>id+'/r'+i),settings:{model:"gemini-flash"}}));
 model.maxReferences=previous;expect(response.status).toBe(400);expect((await response.json()).error).toBe("Too many images for this model: remove an element or a reference");
});

it("keeps every attachment with one element photo when that meets the model budget",async()=>{
 mock.profiles.studio_elements={name:"Acme",kind:"logo",refs:[id+"/a",id+"/b",id+"/c"],notes:""};mock.profiles.studio_styles={name:"Look",refs:[id+"/style"],notes:""};
 const {imageModels}=await import("../src/lib/image-models");const model=imageModels.find(m=>m.id==="flare")!;const previous=model.maxReferences;model.maxReferences=2;
 try{expect((await POST(request({elementIds:[id],styleId:id}))).status).toBe(200);const {mediate}=await import('../src/lib/mediator');expect(vi.mocked(mediate).mock.calls.at(-1)![0].attachments).toEqual([{role:"element",kind:"logo",name:"Acme",images:[1]},{role:"style",name:"Look",images:[2]}]);}finally{model.maxReferences=previous;}
});
