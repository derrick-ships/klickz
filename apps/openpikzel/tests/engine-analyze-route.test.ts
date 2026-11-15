import { it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
const state = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  jobs: new Map<string, any>(),
  evaluate: vi.fn(),
  image: Buffer.alloc(0),
}));
vi.mock("../src/lib/server", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/server")>("../src/lib/server");
  return {
    ...actual,
    withUserProviders: async (_r: Request, run: () => Promise<Response>) => {
      const { providerContext } = await import("../src/lib/provider-context");
      return providerContext.run({ jev: "fixture", openai: "fixture" }, run);
    },
    authenticated: async () => ({
      user: { id: "owner" },
      db: {
        from: (table: string) => {
          let id = "", operation = "read", value: any;
          const chain: any = {
            select: () => chain,
            eq: (key: string, v: string) => { if (key === "id") id = v; return chain; },
            single: async () => ({ data: state.rows.get(id) || null, error: state.rows.has(id) ? null : { message: "missing" } }),
            maybeSingle: async () => ({ data: table === "studio_jobs" ? state.jobs.get(id) || null : state.rows.get(id) || null, error: null }),
            insert: (v: any) => { operation = "insert"; value = v; return chain; },
            update: (v: any) => { operation = "update"; value = v; return chain; },
            then: (resolve: any) => {
              if (table === "studio_jobs") {
                if (operation === "insert") state.jobs.set(value.id, value);
                if (operation === "update") state.jobs.set(id, { ...state.jobs.get(id), ...value });
              } else if (operation === "update") state.rows.set(id, { ...state.rows.get(id), ...value });
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return chain;
        },
      },
    }),
  };
});
vi.mock("../src/lib/providers", () => ({ evaluateThumbnail: state.evaluate }));
vi.mock("../src/lib/assets", () => ({ ownedAsset: async () => state.image }));
import { POST } from "../src/app/api/analyze/route";
import { enrichDiagnostic, digest, actualPreview } from "../src/lib/diagnostics";
import { parseScores } from "../src/lib/validation";
import { pillars } from "../src/lib/types";

const parentId = "11111111-1111-4111-8111-111111111111", childId = "22222222-2222-4222-8222-222222222222";
const request = (extra = {}) =>
  new Request("https://openpikzels.com/api/analyze", { method: "POST", body: JSON.stringify({ creationId: childId, title: "Petro PERDIÓ el control", includeVision: true, critiqueProvider: "openai", requestId: crypto.randomUUID(), ...extra }) });
async function realScore(context: any, overall: number) {
  const s = parseScores({ answers: Object.fromEntries(pillars.map((p) => [p, { score: 2, confidence: 0.8 }])) });
  const small = await actualPreview(state.image), meta = await sharp(small).metadata();
  const e = enrichDiagnostic(s, state.image, context.title, { videoBrief: "", audience: "", includeVision: true, critiqueProvider: "openai", scorer: "jev", fixHistory: context.fixHistory, cacheKey: { title: context.title, videoBrief: "", videoUrl: "" } }, { width: meta.width!, height: meta.height!, digest: digest(small) }, true);
  return { ...e, overall };
}
beforeEach(async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64));
  state.image = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#225588" } }).png().toBuffer();
  state.rows.clear();
  state.jobs.clear();
  state.rows.set(parentId, { id: parentId, image_path: "owner/p.png", parent_id: null, score: { overall: 70 }, lineage: {} });
  state.rows.set(childId, { id: childId, image_path: "owner/c.png", parent_id: parentId, mode: "fix", score: null, lineage: { fix: { suggestion: "Make the face larger", keep: ["face"], parentScore: 70 } } });
  state.evaluate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

it("returns the saved score on a same-input cache hit without calling any provider", async () => {
  const history = [{ suggestion: "Make the face larger", before: 70, after: null }];
  const saved = await realScore({ title: "Petro PERDIÓ el control", fixHistory: history }, 65);
  state.rows.set(childId, { ...state.rows.get(childId), score: saved });
  const r = await POST(request());
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.reused).toBe(true);
  expect(body.score.inputDigest).toBe(saved.inputDigest);
  expect(state.evaluate).not.toHaveBeenCalled();
  expect(state.jobs.size).toBe(0);
  expect(body.comparison).toEqual({ improved: false, before: 70, after: 65, bestId: parentId });
});

it("re-scores when the title differs, or when rescore is requested, and passes fix history to the reviewer", async () => {
  const saved = await realScore({ title: "Petro PERDIÓ el control", fixHistory: [{ suggestion: "Make the face larger", before: 70, after: null }] }, 65);
  state.rows.set(childId, { ...state.rows.get(childId), score: saved });
  state.evaluate.mockImplementation(async (_i: Buffer, title: string) => ({ ...saved, title, overall: 78 }));
  const r = await POST(request({ title: "Another title" }));
  const body = await r.json();
  expect(state.evaluate).toHaveBeenCalledTimes(1);
  expect(state.evaluate.mock.calls[0][3].fixHistory).toEqual([{ suggestion: "Make the face larger", before: 70, after: null }]);
  expect(body.comparison).toEqual({ improved: true, before: 70, after: 78, bestId: childId });
  await POST(request({ rescore: true }));
  expect(state.evaluate).toHaveBeenCalledTimes(2);
});

it("does not reuse a score saved under an older instruction version", async () => {
  const saved = await realScore({ title: "Petro PERDIÓ el control", fixHistory: [{ suggestion: "Make the face larger", before: 70, after: null }] }, 65);
  state.rows.set(childId, { ...state.rows.get(childId), score: { ...saved, instructionVersion: "openpikzels-harness-1.3-soul-ta" } });
  state.evaluate.mockImplementation(async () => ({ ...saved, overall: 66 }));
  await POST(request());
  expect(state.evaluate).toHaveBeenCalledTimes(1);
});
