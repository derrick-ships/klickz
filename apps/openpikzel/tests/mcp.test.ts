import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { pillars } from "../src/lib/types";
const state = vi.hoisted(() => ({
  scope: ["studio:read", "studio:write", "studio:ai"],
  score: {} as any,
  memory: [] as any[],
  keys: { jev: "sk-jev-test-0000FAKE", anthropic: "sk-ant-test-0000FAKE" } as Record<string, string>,
  uploads: [] as any[],
  objects: {} as Record<string, { created_at: string; size: number; mimetype?: string; bytes?: Buffer }>,
  now: () => new Date("2026-11-10T00:00:00.000Z"),
  analyzeCalls: [] as any[],
  analyzeCharges: 0,
  analyzeByRequestId: {} as Record<string, any>,
  analyzeFailure: false as boolean,
  planCalls: [] as any[],
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
              select: () => {
                if (action === "delete") action = "delete-select";
                return chain;
              },
              update: (v: any) => {
                action = "update";
                value = v;
                return chain;
              },
              eq: (k: string, v: string) => {
                filters[k] = v;
                return chain;
              },
              is: (k: string, v: any) => {
                filters["is:" + k] = v;
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
              maybeSingle: async () => chain.single(),
              single: async () => {
                if (table === "studio_upload_urls") {
                  if (action === "insert") {
                    const row = { used_at: null, used_request_id: null, ...value };
                    state.uploads.push(row);
                    return { data: row, error: null };
                  }
                  let rows = state.uploads.filter(
                    (u) =>
                      (!filters.user_id || u.user_id === filters.user_id) &&
                      (!filters.id || u.id === filters.id) &&
                      (!filters.path || u.path === filters.path),
                  );
                  if (action === "update") {
                    if (filters["is:used_at"] === null) rows = rows.filter((u) => u.used_at == null);
                    if (!rows.length) return { data: null, error: { message: "not found" } };
                    Object.assign(rows[0], value);
                    return { data: rows[0], error: null };
                  }
                  if (!rows.length) return { data: null, error: { message: "not found" } };
                  return { data: rows[0], error: null };
                }
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
                if (table === "studio_upload_urls") {
                  let rows = state.uploads.filter(
                    (u) =>
                      (!filters.user_id || u.user_id === filters.user_id) &&
                      (!filters.id || u.id === filters.id) &&
                      (!filters.path || u.path === filters.path),
                  );
                  if (action === "update") {
                    if (filters["is:used_at"] === null) rows = rows.filter((u) => u.used_at == null);
                    for (const row of rows) Object.assign(row, value);
                    return Promise.resolve({ data: rows, error: null }).then(resolve);
                  }
                  return Promise.resolve({ data: rows, error: null }).then(resolve);
                }
                if (table === "studio_agent_memory") {
                  if (action === "delete" || action === "delete-select") {
                    const removed = state.memory.filter(
                      (row) =>
                        filters.id === row.id && filters.user_id === row.user_id,
                    );
                    state.memory = state.memory.filter(
                      (row) => !removed.includes(row),
                    );
                    return Promise.resolve({
                      data:
                        action === "delete-select"
                          ? removed.map((row) => ({ id: row.id }))
                          : null,
                      error: null,
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
          rpc: async (name: string, args: any) => {
            if (name !== "studio_claim_upload_url")
              return { data: null, error: { message: "unknown rpc" } };
            const row = state.uploads.find((u) => u.id === args.upload_id);
            // PostgREST SETOF: a miss is [], a hit is [row].
            if (!row) return { data: [], error: null };
            const now = Date.now();
            if (Date.parse(row.expires_at) < now) return { data: [], error: null };
            if (row.used_at && row.used_request_id !== args.request_id)
              return { data: [], error: null };
            Object.assign(row, {
              used_at: new Date(now).toISOString(),
              used_request_id: args.request_id,
            });
            return { data: [row], error: null };
          },
          storage: {
            from: () => ({
              createSignedUrl: async (path: string) => ({
                data: { signedUrl: "https://test.supabase.co/signed-preview?path=" + path },
                error: null,
              }),
              createSignedUploadUrl: async (path: string) => ({
                data: {
                  signedUrl:
                    "https://test.supabase.co/storage/v1/object/upload/sign/studio-assets/" +
                    path +
                    "?token=fixture-upload",
                  path,
                  token: "fixture-upload",
                },
                error: null,
              }),
              upload: async (path: string, body: Buffer, opts?: { contentType?: string }) => {
                const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body as any);
                state.objects[path] = {
                  created_at: state.now().toISOString(),
                  size: bytes.length,
                  mimetype: opts?.contentType || "image/png",
                  bytes,
                };
                return { data: { path }, error: null };
              },
              download: async (path: string) => {
                const obj = state.objects[path];
                if (!obj?.bytes) return { data: null, error: { message: "not found" } };
                return { data: new Blob([new Uint8Array(obj.bytes)]), error: null };
              },
              list: async (folder: string, opts?: { search?: string }) => {
                const prefix = folder.endsWith("/") ? folder : folder + "/";
                const search = opts?.search || "";
                const data = Object.entries(state.objects)
                  .filter(([path]) => path.startsWith(prefix))
                  .map(([path, obj]) => ({
                    name: path.slice(prefix.length),
                    created_at: obj.created_at,
                    metadata: { size: obj.size, mimetype: obj.mimetype },
                  }))
                  .filter((item) => !search || item.name === search || item.name.includes(search));
                return { data, error: null };
              },
            }),
          },
        },
      };
    },
  };
});
vi.mock("../src/lib/provider-context", async () => {
  const actual = await vi.importActual<any>("../src/lib/provider-context");
  return { ...actual, userKeys: async () => state.keys };
});
vi.mock("@/app/api/analyze/route", () => ({
  POST: async (request: Request) => {
    const { createHash } = await import("node:crypto");
    const body = await request.json();
    state.analyzeCalls.push(body);
    if (state.analyzeFailure) {
      state.analyzeCharges += 1;
      return Response.json(
        { error: "The operation could not finish. Your saved work is safe. Check provider setup or try again." },
        { status: 502 },
      );
    }
    const bytes = body.imagePath ? state.objects[body.imagePath]?.bytes : undefined;
    const sourceDigest = bytes
      ? createHash("sha256").update(bytes).digest("hex")
      : undefined;
    const prior = state.analyzeByRequestId[body.requestId];
    if (prior) {
      if (prior.sourceDigest && sourceDigest && prior.sourceDigest !== sourceDigest)
        return Response.json({ error: "This request already used a different image." }, { status: 409 });
      return Response.json(prior.result);
    }
    state.analyzeCharges += 1;
    const creationId = body.creationId || "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
    const result = { score: state.score, creationId, jobId: body.requestId };
    state.analyzeByRequestId[body.requestId] = { result, sourceDigest };
    return Response.json(result);
  },
}));
vi.mock("@/app/api/fix-plan/route", () => ({
  POST: async (request: Request) => {
    const body = await request.json();
    state.planCalls.push(body);
    return Response.json({
      kind: "ready",
      token: "fixture-plan-token",
      plan: { sourceId: body.creationId, title: "The actual video title", settings: body.settings },
    });
  },
}));
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
  state.keys = { jev: "sk-jev-test-0000FAKE", anthropic: "sk-ant-test-0000FAKE" };
  state.uploads = [];
  state.objects = {};
  state.now = () => new Date("2026-11-10T00:00:00.000Z");
  state.analyzeCalls = [];
  state.analyzeCharges = 0;
  state.analyzeByRequestId = {};
  state.analyzeFailure = false;
  state.planCalls = [];
  state.score = {
    source: "jev",
    version: 3,
    title: "The actual video title",
    overall: 60,
    priority: "clarity",
    created_at: "2026-11-10T00:00:00.000Z",
    note: "Fixture score.",
    vision: true,
    dimensions: Object.fromEntries(
      pillars.map((p) => [p, { score: p === "clarity" ? 40 : 65, fix: "Shorten competing text" }]),
    ),
    contributors: [
      { provider: "Jev", model: "jev-latest", role: "scoring" },
      { provider: "Anthropic API", model: "fixture", role: "image-review" },
    ],
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

it("marks forget_fact as a destructive tool", async () => {
  state.scope = ["studio:read", "studio:write", "studio:ai", "studio:agent"];
  const tools = await (await call("tools/list", {})).json();
  const forget = tools.result.tools.find((t: any) => t.name === "forget_fact");
  expect(forget.annotations.destructiveHint).toBe(true);
});


const uid = "11111111-1111-4111-8111-111111111111";
const requestA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const requestB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function invoke(name: string, args: Record<string, unknown>) {
  return (await (await call("tools/call", { name, arguments: args })).json()).result;
}

function errorText(result: any) {
  return String(result?.content?.[0]?.text || "");
}

function plantUpload(
  path: string,
  created_at: string,
  size = 128,
  mimetype = "image/png",
  bytes: Buffer = Buffer.from(PNG_1X1, "base64"),
) {
  state.objects[path] = { created_at, size, mimetype, bytes };
}

describe("OP-17 analyze_thumbnail and create_upload_url", () => {
  it("lists the new tools and maps OpenPikzels Analyze in the agent guide", async () => {
    const tools = await (await call("tools/list", {})).json();
    const names = tools.result.tools.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(["analyze_thumbnail", "create_upload_url"]));
    const analyze = tools.result.tools.find((t: any) => t.name === "analyze_thumbnail");
    expect(analyze.title).toBe("OpenPikzels Analyze");
    const workspace = await invoke("get_workspace", {});
    expect(workspace.structuredContent.guide).toMatch(/OpenPikzels Analyze/);
    expect(workspace.structuredContent.guide).toMatch(/analyze_thumbnail/);
  });

  it("create_upload_url returns a user-scoped path, signed URL, command, and expires_at five minutes after issue", async () => {
    const result = await invoke("create_upload_url", {});
    expect(result.isError).not.toBe(true);
    const body = result.structuredContent;
    expect(body.imagePath).toMatch(new RegExp("^" + uid + "/references/[0-9a-f-]{36}\\.png$", "i"));
    expect(body.signedUrl).toContain(body.imagePath);
    expect(body.signedUrl).toContain("token=");
    expect(body.uploadCommand).toContain(body.signedUrl);
    expect(Date.parse(body.expires_at) - Date.parse(state.uploads[0].issued_at)).toBe(5 * 60 * 1000);
    expect(state.uploads).toHaveLength(1);
    expect(state.uploads[0].user_id).toBe(uid);
    expect(state.uploads[0].path).toBe(body.imagePath);
  });

  it("analyzes a signed upload inside the window and returns the shared output shape and a plain text summary", async () => {
    const created = await invoke("create_upload_url", {});
    const imagePath = created.structuredContent.imagePath;
    plantUpload(imagePath, "2026-11-10T00:02:00.000Z");
    const result = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      videoBrief: "A factual brief",
      requestId: requestA,
    });
    expect(result.isError).not.toBe(true);
    const body = result.structuredContent;
    expect(body).toMatchObject({
      creationId: expect.any(String),
      score: expect.objectContaining({ overall: 60, priority: "clarity" }),
      reviewer: "Claude",
      fix: { kind: "ready", token: "fixture-plan-token" },
      previewUrl: expect.stringContaining("https://test.supabase.co/signed-preview"),
    });
    expect(result.content[0].text).toContain("60");
    expect(result.content[0].text).toMatch(/clarity/i);
    expect(result.content[0].text).toContain("Shorten competing text");
    expect(result.content[0].text).toContain("Claude");
    expect(result.content[0].text).not.toMatch(/^\s*\{/);
    expect(state.analyzeCalls[0]).toMatchObject({
      imagePath,
      title: "The actual video title",
      videoBrief: "A factual brief",
      includeVision: true,
      critiqueProvider: "anthropic",
      requestId: requestA,
    });
    expect(state.planCalls[0].creationId).toBe(body.creationId);
    expect(state.analyzeCharges).toBe(1);
  });

  it("rejects a signed upload whose object was created after expires_at", async () => {
    const created = await invoke("create_upload_url", {});
    const imagePath = created.structuredContent.imagePath;
    state.uploads[0].expires_at = "2026-11-10T00:05:00.000Z";
    plantUpload(imagePath, "2026-11-10T00:05:00.001Z");
    const result = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toBe("upload link expired, request a new one");
    expect(state.analyzeCharges).toBe(0);
  });

  it("rejects reusing a signed upload id on a later analyze", async () => {
    const created = await invoke("create_upload_url", {});
    const imagePath = created.structuredContent.imagePath;
    plantUpload(imagePath, "2026-11-10T00:01:00.000Z");
    const first = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(first.isError).not.toBe(true);
    const second = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestB,
    });
    expect(second.isError).toBe(true);
    expect(errorText(second)).toMatch(/already/i);
    expect(state.analyzeCharges).toBe(1);
  });

  it("rejects a signed upload id whose object never appeared", async () => {
    const created = await invoke("create_upload_url", {});
    const imagePath = created.structuredContent.imagePath;
    const result = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toMatch(/not (found|uploaded)|never appeared|no file/i);
    expect(state.analyzeCharges).toBe(0);
  });

  it("returns the same output shape for creationId, imagePath and base64 sources", async () => {
    const fromCreation = await invoke("analyze_thumbnail", {
      creationId: uid,
      title: "The actual video title",
      requestId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    });
    expect(fromCreation.isError).not.toBe(true);

    const uploaded = await invoke("create_upload_url", {});
    const imagePath = uploaded.structuredContent.imagePath;
    plantUpload(imagePath, "2026-11-10T00:01:00.000Z");
    const fromPath = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
    });
    expect(fromPath.isError).not.toBe(true);

    const fromBase64 = await invoke("analyze_thumbnail", {
      base64: PNG_1X1,
      title: "The actual video title",
      requestId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    });
    expect(fromBase64.isError).not.toBe(true);

    for (const result of [fromCreation, fromPath, fromBase64]) {
      expect(Object.keys(result.structuredContent).sort()).toEqual(
        ["creationId", "fix", "previewUrl", "reviewer", "score"].sort(),
      );
      expect(result.structuredContent.score.overall).toBe(60);
      expect(result.structuredContent.reviewer).toBe("Claude");
      expect(result.structuredContent.fix).toEqual({ kind: "ready", token: "fixture-plan-token" });
      expect(result.content[0].text).toContain("Claude");
    }
  });

  it("rejects paths outside the user folder, oversized base64, and non-image base64", async () => {
    const outside = await invoke("analyze_thumbnail", {
      imagePath: "22222222-2222-4222-8222-222222222222/references/nope.png",
      title: "The actual video title",
      requestId: requestA,
    });
    expect(outside.isError).toBe(true);
    expect(errorText(outside)).toMatch(/not in your library/i);

    const oversized = await invoke("analyze_thumbnail", {
      base64: Buffer.alloc(2 * 1024 * 1024 + 1, 1).toString("base64"),
      title: "The actual video title",
      requestId: requestB,
    });
    expect(oversized.isError).toBe(true);
    expect(errorText(oversized)).toMatch(/2 MB/i);

    const nonImage = await invoke("analyze_thumbnail", {
      base64: Buffer.from("this is not an image").toString("base64"),
      title: "The actual video title",
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    });
    expect(nonImage.isError).toBe(true);
    expect(errorText(nonImage)).toMatch(/PNG, JPEG or WebP/i);
    expect(state.analyzeCharges).toBe(0);
  });

  it("requires both studio:ai and studio:write, like score_thumbnail", async () => {
    for (const scope of [["studio:read"], ["studio:read", "studio:write"], ["studio:read", "studio:ai"]]) {
      state.scope = scope;
      const result = await invoke("analyze_thumbnail", {
        creationId: uid,
        title: "The actual video title",
        requestId: requestA,
      });
      expect(result.isError).toBe(true);
      expect(errorText(result)).toMatch(/studio:ai|studio:write|Reconnect and allow/i);
    }
  });

  it("replays the same requestId and does not charge twice", async () => {
    const first = await invoke("analyze_thumbnail", {
      creationId: uid,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(first.isError).not.toBe(true);
    const second = await invoke("analyze_thumbnail", {
      creationId: uid,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(second.isError).not.toBe(true);
    expect(state.analyzeCalls).toHaveLength(2);
    expect(state.analyzeCalls[0].requestId).toBe(requestA);
    expect(state.analyzeCalls[1].requestId).toBe(requestA);
    expect(state.analyzeCharges).toBe(1);
    expect(second.structuredContent.creationId).toBe(first.structuredContent.creationId);
    expect(second.structuredContent.score.overall).toBe(60);
  });

  it("two concurrent analyze calls on the same upload id have one winner and one billed analyze", async () => {
  const created = await invoke("create_upload_url", {});
  const imagePath = created.structuredContent.imagePath;
  plantUpload(imagePath, "2026-11-10T00:01:00.000Z");
  const [first, second] = await Promise.all([
    invoke("analyze_thumbnail", { imagePath, title: "The actual video title", requestId: requestA }),
    invoke("analyze_thumbnail", { imagePath, title: "The actual video title", requestId: requestB }),
  ]);
  const results = [first, second];
  const won = results.filter((r) => r.isError !== true);
  const lost = results.filter((r) => r.isError === true);
  expect(won).toHaveLength(1);
  expect(lost).toHaveLength(1);
  expect(errorText(lost[0])).toMatch(/already/i);
  expect(state.analyzeCharges).toBe(1);
});

  it("a same-requestId replay after expires_at is rejected", async () => {
  const created = await invoke("create_upload_url", {});
  const imagePath = created.structuredContent.imagePath;
  plantUpload(imagePath, "2026-11-10T00:01:00.000Z");
  const first = await invoke("analyze_thumbnail", {
    imagePath,
    title: "The actual video title",
    requestId: requestA,
  });
  expect(first.isError).not.toBe(true);
  // Object was uploaded inside the original window (00:01 < original expires_at).
  // expires_at is then moved earlier than now but still after created_at, so only the claim's now() <= expires_at should reject a replay.
  state.uploads[0].expires_at = "2026-11-10T00:04:00.000Z";
  const replay = await invoke("analyze_thumbnail", {
    imagePath,
    title: "The actual video title",
    requestId: requestA,
  });
  expect(replay.isError).toBe(true);
  expect(errorText(replay)).toBe("upload link expired, request a new one");
  expect(state.analyzeCharges).toBe(1);
});

  it("replays a base64 retry with the same requestId on a deterministic path", async () => {
    const first = await invoke("analyze_thumbnail", {
      base64: PNG_1X1,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(first.isError).not.toBe(true);
    const second = await invoke("analyze_thumbnail", {
      base64: PNG_1X1,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(second.isError).not.toBe(true);
    expect(state.analyzeCalls[0].imagePath).toBe(state.analyzeCalls[1].imagePath);
    expect(state.analyzeCalls[0].imagePath).toMatch(
      new RegExp("^" + uid + "/references/[0-9a-f]{64}\\.png$"),
    );
    expect(state.analyzeCharges).toBe(1);
    expect(Object.keys(state.objects)).toHaveLength(1);
    expect(second.structuredContent.creationId).toBe(first.structuredContent.creationId);
  });

  it("rejects a same-requestId base64 retry when the image digest differs", async () => {
    const other = (await (await import("sharp")).default({
      create: { width: 1, height: 1, channels: 3, background: "red" },
    }).png().toBuffer()).toString("base64");
    const first = await invoke("analyze_thumbnail", {
      base64: PNG_1X1,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(first.isError).not.toBe(true);
    const second = await invoke("analyze_thumbnail", {
      base64: other,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(second.isError).toBe(true);
    expect(errorText(second)).toMatch(/409|different image/i);
    expect(state.analyzeCharges).toBe(1);
  });

  it("rejects a non-image signed upload without using the link", async () => {
    const created = await invoke("create_upload_url", {});
    const imagePath = created.structuredContent.imagePath;
    const junk = Buffer.from("<html>not an image</html>");
    plantUpload(imagePath, "2026-11-10T00:01:00.000Z", junk.length, "image/png", junk);
    const result = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toMatch(/not an image/i);
    expect(state.uploads[0].used_at).toBeNull();
    expect(state.analyzeCharges).toBe(0);
  });

  it("does not call a burned link already analyzed after a failed analyze", async () => {
    const created = await invoke("create_upload_url", {});
    const imagePath = created.structuredContent.imagePath;
    plantUpload(imagePath, "2026-11-10T00:01:00.000Z");
    state.analyzeFailure = true;
    const first = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestA,
    });
    expect(first.isError).toBe(true);
    state.analyzeFailure = false;
    const second = await invoke("analyze_thumbnail", {
      imagePath,
      title: "The actual video title",
      requestId: requestB,
    });
    expect(second.isError).toBe(true);
    expect(errorText(second)).toMatch(/already used/i);
    expect(errorText(second)).not.toMatch(/already analyzed/i);
  });

});
