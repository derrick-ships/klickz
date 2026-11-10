import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { pillars } from "../src/lib/types";
const state = vi.hoisted(() => ({
  scope: ["studio:read", "studio:write", "studio:ai"],
  score: {} as any,
  memory: [] as any[],
}));
vi.mock("../src/lib/oauth/core", async () => {
  const actual = await vi.importActual<any>("../src/lib/oauth/core");
  return {
    ...actual,
    resolveAccess: async (_token: string, scope = "studio:read") => {
      if (!state.scope.includes(scope)) throw new Error("permission");
      return {
        user: { id: "11111111-1111-4111-8111-111111111111" },
        oauth: { scope: state.scope },
        db: {
          from: (table: string) => {
            let action = "select",
              value: any,
              filters: Record<string, string> = {},
              pattern = "",
              limit = 20;
            const chain: any = {
              insert: (v: any) => {
                action = "insert";
                value = v;
                return chain;
              },
              delete: () => {
                action = "delete";
                return chain;
              },
              select: () => chain,
              eq: (k: string, v: string) => {
                filters[k] = v;
                return chain;
              },
              ilike: (_k: string, v: string) => {
                pattern = v.replaceAll("%", "").toLowerCase();
                return chain;
              },
              order: () => chain,
              limit: (n: number) => {
                limit = n;
                return chain;
              },
              single: async () => {
                if (table === "studio_agent_memory" && action === "insert") {
                  const row = {
                    id: "ccccccc1-ccc1-4cc1-8cc1-ccccccccccc1",
                    created_at: "2026-11-10T11:50:00.000Z",
                    tags: [],
                    ...value,
                  };
                  state.memory.push(row);
                  return {
                    data: {
                      id: row.id,
                      fact: row.fact,
                      tags: row.tags,
                      created_at: row.created_at,
                    },
                    error: null,
                  };
                }
                return {
                  data: {
                    id: "11111111-1111-4111-8111-111111111111",
                    title: "The actual video title",
                    image_path: "image",
                    score: state.score,
                  },
                  error: null,
                };
              },
              then: (resolve: any) => {
                if (table === "studio_agent_memory") {
                  if (action === "delete") {
                    const before = state.memory.length;
                    state.memory = state.memory.filter(
                      (row) =>
                        !(
                          filters.id === row.id &&
                          filters.user_id === row.user_id
                        ),
                    );
                    return Promise.resolve({
                      data: null,
                      error: null,
                      count: before - state.memory.length,
                    }).then(resolve);
                  }
                  const data = state.memory
                    .filter(
                      (row) =>
                        (!filters.user_id || row.user_id === filters.user_id) &&
                        (!pattern ||
                          String(row.fact).toLowerCase().includes(pattern)),
                    )
                    .sort((a, b) =>
                      String(b.created_at).localeCompare(String(a.created_at)),
                    )
                    .slice(0, limit)
                    .map(({ id, fact, tags, created_at }) => ({
                      id,
                      fact,
                      tags,
                      created_at,
                    }));
                  return Promise.resolve({ data, error: null }).then(resolve);
                }
                return Promise.resolve({
                  data:
                    table === "studio_provider_keys"
                      ? [{ provider: "jev" }]
                      : [],
                  error: null,
                }).then(resolve);
              },
            };
            return chain;
          },
          storage: {
            from: () => ({
              createSignedUrl: async () => ({
                data: { signedUrl: "https://test.supabase.co/signed-preview" },
                error: null,
              }),
            }),
          },
        },
      };
    },
  };
});
import { POST, GET } from "../src/app/mcp/route";
const call = (method: string, params: unknown, id = 1) =>
  POST(
    new Request("https://openpikzels.com/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer opz1.test",
        Accept: "application/json,text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-11-25",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://openpikzels.com");
  state.scope = ["studio:read", "studio:write", "studio:ai"];
  state.memory = [];
  state.score = {
    version: 2,
    title: "The actual video title",
    dimensions: Object.fromEntries(
      pillars.map((p) => [p, { score: 50, fix: "Shorten competing text" }]),
    ),
  };
});
afterEach(() => vi.unstubAllEnvs());
describe("real Streamable HTTP MCP transport and Apps resources", () => {
  it("challenges unauthenticated clients with protected resource discovery", async () => {
    const r = await GET(new Request("https://openpikzels.com/mcp"));
    expect(r.status).toBe(401);
    expect(r.headers.get("WWW-Authenticate")).toContain(
      "/.well-known/oauth-protected-resource/mcp",
    );
  });
  it("negotiates protocol and lists the complete real backend tools", async () => {
    const init = await call("initialize", {
      protocolVersion: "2025-11-25",
      clientInfo: { name: "test-client", version: "1" },
      capabilities: {},
    });
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe("OpenPikzels");
    const tools = await (await call("tools/list", {})).json();
    expect(tools.result.tools.map((t: any) => t.name)).toEqual(
      expect.arrayContaining([
        "get_profile",
        "generate_thumbnail",
        "score_thumbnail",
        "get_fix_prompt",
        "one_click_fix",
        "resize_thumbnail",
        "recompose_thumbnail",
        "enhance_prompt",
      ]),
    );
    expect(
      tools.result.tools.find((t: any) => t.name === "score_thumbnail")._meta.ui
        .resourceUri,
    ).toBe("ui://openpikzels/studio.html");
  });
  it("serves bundled HTML with an MCP Apps bridge and no external script dependency", async () => {
    const r = await (
      await call("resources/read", { uri: "ui://openpikzels/studio.html" })
    ).json();
    const content = r.result.contents[0];
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).toContain("Fix prompt for ChatGPT");
    expect(content.text).toContain("ui/initialize");
    expect(content._meta.ui.csp.connectDomains).toEqual([]);
    expect(content.text).not.toMatch(/<script[^>]+src=/);
  });
  it("returns a copyable fix prompt without invoking image generation", async () => {
    const r = await (
      await call("tools/call", {
        name: "get_fix_prompt",
        arguments: { creationId: "11111111-1111-4111-8111-111111111111" },
      })
    ).json();
    expect(r.result.structuredContent.prompt).toContain(
      "Edit the attached original thumbnail",
    );
    expect(r.result.structuredContent.prompt).toContain(
      "Shorten competing text",
    );
  });
  it("blocks paid tools for read-only grants and denies untrusted browser origins", async () => {
    state.scope = ["studio:read"];
    const r = await (
      await call("tools/call", {
        name: "suggest_titles",
        arguments: { prompt: "A specific video concept" },
      })
    ).json();
    expect(r.result.isError).toBe(true);
    const browser = await POST(
      new Request("https://openpikzels.com/mcp", {
        method: "POST",
        headers: { Origin: "https://evil.test" },
      }),
    );
    expect(browser.status).toBe(403);
  });
});

it("requires both AI and write scopes for source recomposition",async()=>{
 for(const scope of [["studio:read"],["studio:read","studio:ai"]]){
  state.scope=scope;
  const result=await(await call("tools/call",{name:"recompose_thumbnail",arguments:{creationId:"11111111-1111-4111-8111-111111111111",format:"short",requestId:"22222222-2222-4222-8222-222222222222"}})).json();
  expect(result.result.isError).toBe(true);
 }
});

it("lists memory tools and rejects remember_fact without studio:agent", async () => {
  const tools = await (await call("tools/list", {})).json();
  expect(tools.result.tools.map((t: any) => t.name)).toEqual(
    expect.arrayContaining(["remember_fact", "recall_facts", "forget_fact"]),
  );
  const denied = await (
    await call("tools/call", {
      name: "remember_fact",
      arguments: { fact: "The usual hook is a close-up face.", agent: "default" },
    })
  ).json();
  expect(denied.result.isError).toBe(true);
});

it("remembers, recalls and forgets a fact when studio:agent is granted", async () => {
  state.scope = ["studio:read", "studio:write", "studio:ai", "studio:agent"];
  const saved = await (
    await call("tools/call", {
      name: "remember_fact",
      arguments: { fact: "The usual hook is a close-up face.", tags: ["hook"], agent: "default" },
    })
  ).json();
  expect(saved.result.isError).not.toBe(true);
  const fact = saved.result.structuredContent;
  expect(fact.fact).toBe("The usual hook is a close-up face.");
  const recalled = await (
    await call("tools/call", {
      name: "recall_facts",
      arguments: { query: "hook" },
    })
  ).json();
  expect(recalled.result.structuredContent.facts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: fact.id, fact: "The usual hook is a close-up face." }),
    ]),
  );
  const forgotten = await (
    await call("tools/call", {
      name: "forget_fact",
      arguments: { id: fact.id },
    })
  ).json();
  expect(forgotten.result.structuredContent.forgotten).toBe(true);
});
