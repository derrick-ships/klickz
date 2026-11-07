import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
const mock = vi.hoisted(() => ({
  grants: new Map<string, any>(),
  uses: new Set<string>(),
  user: "11111111-1111-4111-8111-111111111111",
  owner: true,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: mock.user } }, error: null }),
      refreshSession: async () => ({
        data: {
          session: {
            access_token: jwt(),
            refresh_token: "next-session-refresh",
          },
        },
        error: null,
      }),
    },
    rpc: async () => ({ data: mock.owner, error: null }),
    from: (table: string) => {
      let action = "select",
        value: any,
        filters: Record<string, string> = {};
      const chain: any = {
        select: () => chain,
        insert: (v: any) => {
          action = "insert";
          value = v;
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
        single: async () => {
          const row = mock.grants.get(filters.id);
          return {
            data: row && row.client_id === filters.client_id ? row : null,
            error: row ? null : { code: "missing" },
          };
        },
        then: (resolve: any) => {
          let error = null;
          if (action === "insert" && table === "studio_oauth_grants")
            mock.grants.set(value.id, value);
          if (action === "insert" && table === "studio_oauth_uses") {
            if (mock.uses.has(value.nonce_hash)) error = { code: "23505" };
            else mock.uses.add(value.nonce_hash);
          }
          if (action === "update") {
            const old = mock.grants.get(filters.id);
            if (old) mock.grants.set(filters.id, { ...old, ...value });
          }
          return Promise.resolve({ error, data: null }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));
function jwt() {
  return [
    "header",
    Buffer.from(JSON.stringify({ sub: mock.user })).toString("base64url"),
    "signature",
  ].join(".");
}
import {
  registerClient,
  parseAuthorization,
  issueCode,
  exchange,
  resolveAccess,
} from "../src/lib/oauth/core";
import { seal, unseal, mcpResource } from "../src/lib/crypto";
import { GET as resourceMetadata } from "../src/app/.well-known/oauth-protected-resource/route";
import { GET as authorizationMetadata } from "../src/app/.well-known/oauth-authorization-server/route";
import { GET as authorize } from "../src/app/oauth/authorize/route";
import { POST as consent } from "../src/app/api/oauth/consent/route";
const verifier = "a".repeat(64),
  challenge = createHash("sha256").update(verifier).digest("base64url");
function setup() {
  const c = registerClient({
    client_name: "Test Cursor",
    redirect_uris: ["http://127.0.0.1:4500/callback"],
  });
  const url = new URL("https://openpikzels.com/oauth/authorize");
  Object.entries({
    client_id: c.client_id,
    redirect_uri: c.redirect_uris[0],
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: mcpResource(),
    scope: "studio:read studio:write studio:ai",
    state: "client-state",
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  return { c, url, auth: parseAuthorization(url) };
}
beforeEach(() => {
  vi.stubEnv("STUDIO_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("APP_ORIGIN", "https://openpikzels.com");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("OWNER_GATE", "false");
  mock.grants.clear();
  mock.uses.clear();
  mock.owner = true;
});
afterEach(() => vi.unstubAllEnvs());
describe("resource-bound MCP OAuth", () => {
  it("publishes protected-resource and authorization metadata with DCR and S256", async () => {
    expect(await resourceMetadata().json()).toMatchObject({
      resource: "https://openpikzels.com/mcp",
      authorization_servers: ["https://openpikzels.com"],
    });
    expect(await authorizationMetadata().json()).toMatchObject({
      issuer: "https://openpikzels.com",
      code_challenge_methods_supported: ["S256"],
      registration_endpoint: "https://openpikzels.com/oauth/register",
    });
  });
  it("rejects public HTTP, wildcard redirects, fragments, plain PKCE, and other resource audiences", () => {
    expect(() =>
      registerClient({ redirect_uris: ["http://evil.test/callback"] }),
    ).toThrow();
    expect(() =>
      registerClient({ redirect_uris: ["https://client.test/callback#frag"] }),
    ).toThrow();
    const { url } = setup();
    url.searchParams.set("redirect_uri", "https://evil.test");
    expect(() => parseAuthorization(url)).toThrow("Unregistered");
    url.searchParams.set("redirect_uri", "http://127.0.0.1:4500/callback");
    url.searchParams.set("resource", "https://evil.test/mcp");
    expect(() => parseAuthorization(url)).toThrow("exact");
    url.searchParams.set("resource", mcpResource());
    url.searchParams.set("code_challenge_method", "plain");
    expect(() => parseAuthorization(url)).toThrow("S256");
  });
  it("exchanges a single-use PKCE code for short-lived opaque resource-bound tokens", async () => {
    const { auth, c } = setup();
    const code = await issueCode(auth, jwt(), "session-refresh");
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: c.client_id,
      code,
      code_verifier: verifier,
      redirect_uri: auth.redirect,
      resource: mcpResource(),
    });
    const tokens = await exchange(form);
    expect(tokens.expires_in).toBe(900);
    expect(tokens.access_token).not.toContain("session-refresh");
    const resolved = await resolveAccess(tokens.access_token, "studio:ai");
    expect(resolved.user.id).toBe(mock.user);
    expect(resolved.oauth.resource).toBe(mcpResource());
    await expect(exchange(form)).rejects.toThrow("already used");
    const payload = unseal<any>(tokens.access_token, "oauth-access");
    payload.resource = "https://evil.test/mcp";
    await expect(resolveAccess(seal(payload, "oauth-access"))).rejects.toThrow(
      "audience",
    );
  });
  it("rejects code theft without the verifier or using another registered client", async () => {
    const { auth, c } = setup();
    const code = await issueCode(auth, jwt(), "session-refresh");
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: c.client_id,
      code,
      code_verifier: "b".repeat(64),
      redirect_uri: auth.redirect,
      resource: mcpResource(),
    });
    await expect(exchange(form)).rejects.toThrow("PKCE");
    form.set("code_verifier", verifier);
    form.set(
      "client_id",
      registerClient({ redirect_uris: [auth.redirect] }).client_id,
    );
    await expect(exchange(form)).rejects.toThrow("PKCE");
  });
  it("rotates refresh tokens and revokes the family on replay", async () => {
    const { auth, c } = setup();
    const code = await issueCode(auth, jwt(), "session-refresh");
    const tokens = await exchange(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: c.client_id,
        code,
        code_verifier: verifier,
        redirect_uri: auth.redirect,
        resource: mcpResource(),
      }),
    );
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: c.client_id,
      refresh_token: tokens.refresh_token,
      resource: mcpResource(),
    });
    const next = await exchange(form);
    expect(next.refresh_token).not.toBe(tokens.refresh_token);
    await expect(exchange(form)).rejects.toThrow("already used");
    await expect(resolveAccess(next.access_token)).rejects.toThrow("revoked");
  });
  it("enforces expiration, scopes and user revocation", async () => {
    const { auth, c } = setup();
    auth.scope = ["studio:read"];
    const code = await issueCode(auth, jwt(), "session-refresh");
    const tokens = await exchange(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: c.client_id,
        code,
        code_verifier: verifier,
        redirect_uri: auth.redirect,
        resource: mcpResource(),
      }),
    );
    await expect(
      resolveAccess(tokens.access_token, "studio:ai"),
    ).rejects.toThrow("permission");
    const payload = unseal<any>(tokens.access_token, "oauth-access");
    payload.exp = 0;
    await expect(resolveAccess(seal(payload, "oauth-access"))).rejects.toThrow(
      "expired",
    );
    const grant = mock.grants.get(payload.grant);
    grant.revoked_at = new Date().toISOString();
    await expect(resolveAccess(tokens.access_token)).rejects.toThrow("revoked");
  });
  it("requires an app-origin-bound consent cookie and preserves state on Deny without issuing a code", async () => {
    const { url } = setup();
    const redirect = authorize(new Request(url));
    expect(redirect.status).toBe(302);
    const request = new URL(redirect.headers.get("location")!).searchParams.get(
      "request",
    )!;
    const cookie = redirect.headers.get("set-cookie")!.split(";")[0];
    const denied = await consent(
      new Request("https://openpikzels.com/api/oauth/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://openpikzels.com",
          Cookie: cookie,
        },
        body: JSON.stringify({ request, decision: "deny" }),
      }),
    );
    const data = await denied.json();
    expect(new URL(data.redirect).searchParams.get("state")).toBe(
      "client-state",
    );
    expect(new URL(data.redirect).searchParams.get("error")).toBe(
      "access_denied",
    );
    expect(mock.grants.size).toBe(0);
    const csrf = await consent(
      new Request("https://openpikzels.com/api/oauth/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.test",
          Cookie: cookie,
        },
        body: JSON.stringify({ request, decision: "allow" }),
      }),
    );
    expect(csrf.status).toBe(403);
  });
  it("authenticates encryption, prevents token-purpose confusion and never lets tampering through", () => {
    const token = seal({ key: "private-placeholder" }, "provider:a:openai");
    expect(() => unseal(token, "oauth-access")).toThrow();
    expect(() =>
      unseal(token.slice(0, -2) + "aa", "provider:a:openai"),
    ).toThrow();
    expect(unseal(token, "provider:a:openai")).toEqual({
      key: "private-placeholder",
    });
  });
});
