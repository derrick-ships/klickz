import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
const owner = "11111111-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({ styles: [] as any[], uploads: [] as string[], keys: {} as Record<string, string>, fetched: [] as string[], oauth: undefined as any }));
vi.mock("../src/lib/server", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/server")>("../src/lib/server");
  return {
    ...actual,
    authenticated: async () => ({
      user: { id: owner },
      oauth: state.oauth,
      db: {
        storage: { from: () => ({ upload: async (path: string) => { state.uploads.push(path); return { error: null }; } }) },
        from: () => {
          let row: any;
          const chain: any = {
            select: () => chain,
            eq: () => chain,
            insert: (v: any) => { row = { id: "55555555-5555-4555-8555-555555555555", ...v }; state.styles.push(row); return chain; },
            single: async () => ({ data: row, error: null }),
            then: (resolve: any) => Promise.resolve({ data: state.styles, error: null }).then(resolve),
          };
          return chain;
        },
      },
    }),
  };
});
vi.mock("../src/lib/provider-context", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/provider-context")>("../src/lib/provider-context");
  return { ...actual, userKeys: async () => state.keys };
});
vi.mock("../src/lib/reference", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/reference")>("../src/lib/reference");
  return {
    ...actual,
    fetchReference: async (url: string) => {
      state.fetched.push(url);
      const colors = ["#008080", "#ff6600", "#ffd700"];
      return sharp({ create: { width: 120, height: 68, channels: 3, background: colors[state.fetched.length - 1] || "#222222" } }).png().toBuffer();
    },
  };
});
vi.mock("../src/lib/youtube", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/youtube")>("../src/lib/youtube");
  return {
    ...actual,
    channelVideos: async () => ({
      channel: { id: "UCabcdefghijklmnopqrstuv", name: "Noticias Fixture", avatar: "", subscribers: 1, videos: 4 },
      videos: ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"].map((id) => ({ id, title: id, thumbnail: "", views: 1, duration: "", publishedAt: "" })),
      nextPageToken: null,
      notice: "",
    }),
  };
});
const req = (body: unknown) => new Request("https://studio.example/api/styles/study", { method: "POST", headers: { "content-type": "application/json", origin: "https://studio.example" }, body: JSON.stringify(body) });
beforeEach(() => { state.styles = []; state.uploads = []; state.keys = {}; state.fetched = []; state.oauth = undefined; process.env.APP_ORIGIN = "https://studio.example"; });

describe("study a style from a YouTube link", () => {
  it("saves one thumbnail and its measured palette from a single video link without a YouTube key", async () => {
    const { POST } = await import("../src/app/api/styles/study/route");
    const r = await POST(req({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", name: "Teal look" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(state.fetched).toEqual(["https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"]);
    expect(body.profile.name).toBe("Teal look");
    expect(body.profile.refs).toHaveLength(1);
    expect(body.profile.source).toMatchObject({ kind: "youtube", videoIds: ["dQw4w9WgXcQ"], palette: ["#008080"] });
    expect(body.palette[0].hex).toBe("#008080");
    expect(body.profile.notes).toContain("#008080");
  });
  it("studies the top three videos of a channel with the user's own YouTube key", async () => {
    state.keys = { youtube: "fixture-yt" };
    const { POST } = await import("../src/app/api/styles/study/route");
    const r = await POST(req({ url: "@noticiasfixture" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(state.fetched).toHaveLength(3);
    expect(body.profile.name).toBe("Noticias Fixture");
    expect(body.profile.refs).toHaveLength(3);
    expect(body.profile.source.channelId).toBe("UCabcdefghijklmnopqrstuv");
    expect(body.palette.map((c: any) => c.hex)).toEqual(expect.arrayContaining(["#008080", "#ff6600", "#ffd700"]));
    expect(JSON.stringify(body)).not.toContain("fixture-yt");
  });
  it("asks for a YouTube key before studying a whole channel", async () => {
    const { POST } = await import("../src/app/api/styles/study/route");
    const r = await POST(req({ url: "https://www.youtube.com/@creator" }));
    expect(r.status).toBe(403);
    expect((await r.json()).error).toContain("YouTube Data API key");
    expect(state.styles).toHaveLength(0);
  });
  it("requires write scope for agents", async () => {
    state.oauth = { scope: ["studio:read"] };
    const { POST } = await import("../src/app/api/styles/study/route");
    expect((await POST(req({ url: "https://youtu.be/dQw4w9WgXcQ" }))).status).toBe(403);
  });
});
