import { it, expect, vi, beforeEach } from "vitest";
import { seal } from "../src/lib/crypto";
import { digest, enrichDiagnostic, compileFixPlan } from "../src/lib/diagnostics";
import { signDiagnostic } from "../src/lib/diagnostic-proof";
import { parseScores, observationSchema } from "../src/lib/validation";
import { defaultSettings, pillars } from "../src/lib/types";
const mock = vi.hoisted(() => ({ reservations: [] as any[], updates: [] as any[], render: vi.fn(), mediate: vi.fn(), parent: {} as any }));
vi.mock("../src/lib/server", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/server")>("../src/lib/server");
  return {
    ...actual,
    requireAI: vi.fn(),
    withUserProviders: async (_r: Request, work: () => Promise<Response>) => {
      const { providerContext } = await import("../src/lib/provider-context");
      return providerContext.run({ openai: "fixture" }, work);
    },
    authenticated: async () => ({
      user: { id: "11111111-1111-4111-8111-111111111111" },
      db: {
        from: () => {
          let operation = "read", rows: any[] = [], update: any = {}, id = "";
          const chain: any = {
            select: () => chain,
            eq: (k: string, v: string) => { if (k === "id") id = v; return chain; },
            maybeSingle: async () => ({ data: null, error: null }),
            single: async () => ({ data: operation === "update" ? { ...update, id } : mock.parent, error: null }),
            insert: (v: any[]) => { operation = "insert"; rows = v; mock.reservations = v; return chain; },
            update: (v: any) => { operation = "update"; update = v; mock.updates.push(v); return chain; },
            then: (resolve: any) => Promise.resolve(operation === "insert" ? { data: rows.map((_r, i) => ({ id: `render-${i}`, batch_index: i })), error: null } : { data: null, error: null }).then(resolve),
          };
          return chain;
        },
        storage: { from: () => ({ upload: async () => ({ error: null }) }) },
      },
    }),
  };
});
vi.mock("../src/lib/jobs", () => ({ reserveJob: async () => ({ replay: null }), updateJob: async () => {}, ambiguousProviderError: () => true }));
vi.mock("../src/lib/providers", () => ({ renderThumbnail: mock.render, evaluateThumbnail: vi.fn() }));
vi.mock("../src/lib/assets", () => ({ ownedAsset: async () => Buffer.from("reference") }));
vi.mock("../src/lib/youtube-jpeg", () => ({ youtubeJpeg: async () => Buffer.from("jpg") }));
vi.mock("../src/lib/mediator", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/mediator")>("../src/lib/mediator");
  return { ...actual, mediate: mock.mediate };
});
import { POST } from "../src/app/api/generate/route";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64));
  mock.reservations = [];
  mock.updates = [];
  mock.render.mockReset().mockResolvedValue(Buffer.from("png"));
  mock.mediate.mockReset().mockImplementation(async (input: any) => ({
    substantial: input.substantial,
    provider: "Fixture",
    model: "fixture",
    attempts: 1,
    enriched: { concept: "c", lever: "INTRIGA", imageText: ["¿SE LE VOLTEARON?"], panels: 1, prompt: "EDIT. " + input.rawPrompt, dos: [], donts: [], substantialChanges: [], decisions: [] },
  }));
});

it("a single-suggestion fix sends 'Apply only this change' + keep list to the mediator and records lineage.fix", async () => {
  const source = Buffer.from("reference");
  const observations = observationSchema.parse({
    summary: "s",
    dimensions: Object.fromEntries(pillars.map((p) => [p, { observation: "seen", strength: "s", weakness: "w", fix: "f", flags: p === "emotion" ? ["no_readable_emotion"] : [], suggestions: ["x"] }])),
    suggestion: "Make his expression clearly surprised. Keep the text ¿SE LE VOLTEARON?",
    keep: ["the man's face on the left", "teal background"],
    keepText: ["¿SE LE VOLTEARON?"],
  });
  const answers = { answers: Object.fromEntries(pillars.map((p) => [p, { score: 2, confidence: 0.8 }])) };
  const score = signDiagnostic(enrichDiagnostic(parseScores(answers, observations, "A specific video"), source, "A specific video", { videoBrief: "", audience: "", includeVision: true }, { width: 200, height: 113, digest: digest("p") }, true));
  mock.parent = { id, image_path: id + "/original.png", title: "A specific video", score };
  const history = [{ suggestion: "Earlier", before: 60, after: 67 }];
  const compiled = compileFixPlan(score, id, digest(source), defaultSettings, { exactText: [], requiredObjects: [], forbiddenChanges: [] }, undefined, history);
  if (compiled.kind !== "ready") throw new Error("plan");
  const r = await POST(new Request("http://localhost/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "Apply the reviewed packaging edits while preserving the original.", title: "A specific video", mode: "fix", parentId: id, requestId: crypto.randomUUID(), fixPlanToken: seal(compiled.plan, "fix-plan") }) }));
  expect(r.status).toBe(200);
  const input = mock.mediate.mock.calls[0][0];
  expect(input.rawPrompt).toContain("Edit the attached original image. Apply only this change: Make his expression clearly surprised");
  expect(input.rawPrompt).toContain("the man's face on the left; teal background");
  expect(input.rawPrompt).toContain('"¿SE LE VOLTEARON?"');
  expect(input.substantial.exactText).toEqual(["¿SE LE VOLTEARON?"]);
  expect(input.isEdit).toBe(true);
  // The plan is not sent twice (no "Execute only this reviewed image-edit plan" note).
  expect(input.notes.join("\n")).not.toContain("Execute only this reviewed");
  expect(mock.reservations[0].lineage.fix).toEqual({ suggestion: compiled.plan.suggestion, keep: ["the man's face on the left", "teal background"], keepText: ["¿SE LE VOLTEARON?"], parentScore: score.overall, history });
  expect(mock.render.mock.calls[0][1]).toHaveLength(1);
});
