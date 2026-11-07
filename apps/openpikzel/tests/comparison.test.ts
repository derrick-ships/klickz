import { beforeEach, afterEach, it, expect, vi } from "vitest";
import sharp from "sharp";
const state = vi.hoisted(() => ({
  user: "11111111-1111-4111-8111-111111111111",
  image: Buffer.alloc(0),
  reviews: [] as any[],
  title: "Actual video promise",
  brief: "Factual video brief",
  lineageOnly: false,
}));
const candidate = "22222222-2222-4222-8222-222222222222",
  original = "33333333-3333-4333-8333-333333333333";
vi.mock("../src/lib/server", async () => ({
  ...(await vi.importActual<any>("../src/lib/server")),
  authenticated: async () => ({
    user: { id: state.user },
    db: {
      from: () => {
        let id = "",
          update: any;
        const q: any = {
          select: () => q,
          eq: (k: string, v: string) => {
            if (k === "id") id = v;
            return q;
          },
          single: async () => ({
            data: {
              id,
              parent_id: id === candidate ? original : null,
              image_path: id + ".png",
              title: state.title,
              score: state.lineageOnly ? null : { context: { videoBrief: state.brief, audience: "" } },
              lineage: { plan: { videoBrief: state.brief, audience: "Creators" } },
            },
            error: null,
          }),
          update: (v: any) => {
            update = v;
            return q;
          },
          then: (resolve: any) => {
            state.reviews.push(update);
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return q;
      },
      storage: {
        from: () => ({
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: "https://test.supabase.co/" + path },
            error: null,
          }),
        }),
      },
    },
  }),
}));
vi.mock("../src/lib/assets", () => ({ ownedAsset: async () => state.image }));
import { POST } from "../src/app/api/compare/route";
import { unseal, seal } from "../src/lib/crypto";
const call = (body: unknown) =>
  POST(
    new Request("https://openpikzels.com/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
beforeEach(async () => {
  vi.stubEnv("STUDIO_ENCRYPTION_KEY", "d".repeat(64));
  state.user = "11111111-1111-4111-8111-111111111111";
  state.reviews = [];
  state.title = "Actual video promise";
  state.brief = "Factual video brief";
  state.lineageOnly = false;
  state.image = await sharp({
    create: { width: 1280, height: 720, channels: 3, background: "#df1c2c" },
  })
    .png()
    .toBuffer();
});
afterEach(() => vi.unstubAllEnvs());
it("returns real same-sized A/B previews without scores or lineage metadata", async () => {
  const r = await call({ creationId: candidate });
  expect(r.status).toBe(200);
  const data = await r.json();
  expect(data.options.map((x: any) => x.label)).toEqual(["A", "B"]);
  for (const o of data.options) {
    expect(Object.keys(o)).toEqual(["label", "preview", "fullImage"]);
    expect(
      (await sharp(Buffer.from(o.preview.split(",")[1], "base64")).metadata())
        .width,
    ).toBe(200);
  }
  const pair = unseal<any>(data.token, "blind-compare");
  expect(new Set(pair.order)).toEqual(new Set([candidate, original]));
});
it("maps a human choice back to lineage and keeps the original on tie", async () => {
  const data = await (await call({ creationId: candidate })).json();
  const r = await call({ token: data.token, preference: "tie" });
  expect((await r.json()).keptOriginal).toBe(true);
  expect(state.reviews[0].review.preference).toBe("tie");
  expect(state.reviews[0].review.order).toHaveLength(2);
});
it("rejects cross-account, expired and stale-image votes", async () => {
  const data = await (await call({ creationId: candidate })).json();
  state.user = "other-user";
  expect((await call({ token: data.token, preference: "A" })).status).toBe(403);
  state.user = "11111111-1111-4111-8111-111111111111";
  const pair = unseal<any>(data.token, "blind-compare");
  expect(
    (
      await call({
        token: seal({ ...pair, expires: 0 }, "blind-compare"),
        preference: "A",
      })
    ).status,
  ).toBe(403);
  state.image = Buffer.from("changed");
  expect((await call({ token: data.token, preference: "A" })).status).toBe(409);
  expect(state.reviews).toHaveLength(0);
});

it("rejects votes if the displayed title or factual context changed", async () => {
  const data = await (await call({ creationId: candidate })).json();
  state.title = "A changed promise";
  expect((await call({ token: data.token, preference: "A" })).status).toBe(409);
  state.title = "Actual video promise";
  state.brief = "A changed factual brief";
  expect((await call({ token: data.token, preference: "B" })).status).toBe(409);
  expect(state.reviews).toHaveLength(0);
});

it("uses the approved lineage brief for a fresh fixed variant", async () => {
  state.lineageOnly = true;
  const data = await (await call({ creationId: candidate })).json();
  expect(data.context).toEqual({ title: state.title, videoBrief: state.brief, audience: "Creators" });
  expect((await call({ token: data.token, preference: "tie" })).status).toBe(200);
  expect(state.reviews[0].review.context).toEqual(data.context);
});
