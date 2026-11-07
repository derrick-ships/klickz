import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { publicSupabaseConfig } from "../config";
import { AppError } from "../validation";
import { appOrigin, hash, mcpResource, now, seal, unseal } from "../crypto";
export const scopes = ["studio:read", "studio:write", "studio:ai"] as const;
export type Scope = (typeof scopes)[number];
export type Client = {
  name: string;
  redirects: string[];
  exp: number;
  id: string;
};
export type Authorization = {
  clientId: string;
  redirect: string;
  challenge: string;
  scope: Scope[];
  state: string;
  resource: string;
  exp: number;
  nonce: string;
};
type Session = { access: string; refresh: string };
export type GrantToken = Session & {
  uid: string;
  grant: string;
  client: string;
  resource: string;
  scope: Scope[];
  jti: string;
  exp: number;
};
export const clientSchema = z.object({
  client_name: z.string().trim().min(1).max(120).default("MCP client"),
  redirect_uris: z.array(z.string().url().max(1500)).min(1).max(8),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"]),
});
export function registerClient(body: unknown) {
  const input = clientSchema.parse(body);
  if (input.redirect_uris.join("").length > 3000)
    throw new AppError(400, "Redirect URI metadata is too large.");
  for (const uri of input.redirect_uris) {
    const url = new URL(uri);
    const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname);
    if (
      url.hash ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))
    )
      throw new AppError(
        400,
        "Redirect URIs must use HTTPS, or HTTP on loopback for native apps.",
      );
  }
  const client: Client = {
    name: input.client_name,
    redirects: input.redirect_uris,
    exp: now() + 365 * 86400,
    id: randomUUID(),
  };
  return {
    client_id: seal(client, "oauth-client"),
    client_id_issued_at: now(),
    client_name: client.name,
    redirect_uris: client.redirects,
    token_endpoint_auth_method: "none",
    grant_types: input.grant_types,
    response_types: input.response_types,
  };
}
export function readClient(id: string) {
  const client = unseal<Client>(id, "oauth-client");
  if (client.exp <= now())
    throw new AppError(400, "Client registration expired. Register again.");
  return client;
}
export function parseAuthorization(url: URL): Authorization {
  const q = url.searchParams,
    clientId = q.get("client_id") || "",
    client = readClient(clientId),
    redirect = q.get("redirect_uri") || "";
  if (!client.redirects.includes(redirect))
    throw new AppError(400, "Unregistered redirect URI.");
  if (
    q.get("response_type") !== "code" ||
    q.get("code_challenge_method") !== "S256" ||
    !/^[A-Za-z0-9_-]{43}$/.test(q.get("code_challenge") || "")
  )
    throw new AppError(
      400,
      "Authorization code flow with S256 PKCE is required.",
    );
  if (q.getAll("resource").length !== 1 || q.get("resource") !== mcpResource())
    throw new AppError(400, "Request the exact OpenPikzels MCP resource URL.");
  const requested = (q.get("scope") || "studio:read")
    .split(" ")
    .filter(Boolean);
  if (
    requested.some((x) => !scopes.includes(x as Scope)) ||
    !requested.includes("studio:read")
  )
    throw new AppError(400, "Unsupported scope. Include studio:read.");
  const state = q.get("state") || "";
  if (state.length > 2000) throw new AppError(400, "State is too long.");
  return {
    clientId,
    redirect,
    challenge: q.get("code_challenge")!,
    scope: [...new Set(requested)] as Scope[],
    state,
    resource: mcpResource(),
    exp: now() + 600,
    nonce: randomUUID(),
  };
}
export function readAuthorization(token: string) {
  const value = unseal<Authorization>(token, "oauth-request");
  if (value.exp <= now() || value.resource !== mcpResource())
    throw new AppError(
      400,
      "This consent request expired. Reconnect from your agent.",
    );
  readClient(value.clientId);
  return value;
}
export function database(access: string) {
  const c = publicSupabaseConfig();
  if (!c) throw new AppError(503, "Cloud accounts are not configured.");
  return createClient(c.url, c.key, {
    global: { headers: { Authorization: `Bearer ${access}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function identity(access: string) {
  const db = database(access),
    result = await db.auth.getUser(access);
  if (result.error || !result.data.user)
    throw new AppError(401, "Sign in again to connect your agent.");
  const claims = JSON.parse(
    Buffer.from(access.split(".")[1], "base64url").toString(),
  );
  if (claims.client_id)
    throw new AppError(
      403,
      "Connect through the OpenPikzels OAuth consent flow.",
    );
  if (process.env.OWNER_GATE !== "false") {
    const check = await db.rpc("app_web_access");
    if (check.error || check.data !== true)
      throw new AppError(
        403,
        "The private preview is currently limited to its owner.",
      );
  }
  return { db, user: result.data.user };
}
export async function issueCode(
  auth: Authorization,
  access: string,
  refresh: string,
) {
  const { db, user } = await identity(access),
    client = readClient(auth.clientId),
    grant = randomUUID();
  const inserted = await db.from("studio_oauth_grants").insert({
    id: grant,
    user_id: user.id,
    client_id: hash(auth.clientId),
    client_name: client.name,
    redirect_uri: auth.redirect,
    scope: auth.scope,
    expires_at: new Date((now() + 30 * 86400) * 1000).toISOString(),
  });
  if (inserted.error)
    throw new AppError(503, "Agent access could not be saved.");
  const value: GrantToken = {
    access,
    refresh,
    uid: user.id,
    grant,
    client: hash(auth.clientId),
    resource: auth.resource,
    scope: auth.scope,
    jti: randomUUID(),
    exp: now() + 90,
  };
  return seal(
    { ...value, challenge: auth.challenge, redirect: auth.redirect },
    "oauth-code",
  );
}
export async function activeGrant(value: GrantToken) {
  if (value.resource !== mcpResource())
    throw new AppError(401, "Wrong token audience.");
  const context = await identity(value.access);
  if (context.user.id !== value.uid)
    throw new AppError(401, "Invalid account token.");
  const result = await context.db
    .from("studio_oauth_grants")
    .select("id,scope,revoked_at,expires_at")
    .eq("id", value.grant)
    .eq("client_id", value.client)
    .single();
  if (
    result.error ||
    !result.data ||
    result.data.revoked_at ||
    Date.parse(result.data.expires_at) <= Date.now() ||
    value.scope.some((s) => !result.data.scope.includes(s))
  )
    throw new AppError(401, "Agent access expired or was revoked.");
  return context;
}
async function consume(
  value: GrantToken,
  kind: string,
  context: Awaited<ReturnType<typeof identity>>,
) {
  const result = await context.db.from("studio_oauth_uses").insert({
    user_id: value.uid,
    grant_id: value.grant,
    nonce_hash: hash(value.jti),
    kind,
  });
  if (result.error) {
    if (kind === "refresh")
      await context.db
        .from("studio_oauth_grants")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", value.grant);
    throw new AppError(
      400,
      "This authorization was already used. Reconnect your agent.",
    );
  }
}
function tokens(value: GrantToken) {
  const base = { ...value, jti: randomUUID() };
  return {
    access_token: seal(
      { ...base, refresh: "", exp: now() + 900 },
      "oauth-access",
    ),
    token_type: "Bearer",
    expires_in: 900,
    scope: value.scope.join(" "),
    refresh_token: seal(
      { ...base, jti: randomUUID(), exp: now() + 30 * 86400 },
      "oauth-refresh",
    ),
  };
}
export async function exchange(form: URLSearchParams) {
  const clientId = form.get("client_id") || "";
  readClient(clientId);
  if (form.get("resource") !== mcpResource())
    throw new AppError(400, "A matching resource parameter is required.");
  if (form.get("grant_type") === "authorization_code") {
    const value = unseal<GrantToken & { challenge: string; redirect: string }>(
      form.get("code") || "",
      "oauth-code",
    );
    const verifier = form.get("code_verifier") || "";
    if (
      value.exp <= now() ||
      value.client !== hash(clientId) ||
      form.get("redirect_uri") !== value.redirect ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
      createHash("sha256").update(verifier).digest("base64url") !==
        value.challenge
    )
      throw new AppError(400, "Invalid authorization code or PKCE verifier.");
    const context = await activeGrant(value);
    await consume(value, "code", context);
    return tokens(value);
  }
  if (form.get("grant_type") === "refresh_token") {
    const value = unseal<GrantToken>(
      form.get("refresh_token") || "",
      "oauth-refresh",
    );
    if (
      value.exp <= now() ||
      value.client !== hash(clientId) ||
      value.resource !== mcpResource()
    )
      throw new AppError(
        400,
        "Refresh token expired or belongs to another client.",
      );
    const db = database(value.access),
      refreshed = await db.auth.refreshSession({
        refresh_token: value.refresh,
      });
    if (refreshed.error || !refreshed.data.session)
      throw new AppError(
        400,
        "Your account session expired. Reconnect your agent.",
      );
    const session = refreshed.data.session;
    value.access = session.access_token;
    value.refresh = session.refresh_token;
    const context = await activeGrant(value);
    await consume(value, "refresh", context);
    return tokens(value);
  }
  throw new AppError(400, "Unsupported grant type.");
}
export async function resolveAccess(
  token: string,
  scope: Scope = "studio:read",
) {
  const value = unseal<GrantToken>(token, "oauth-access");
  if (value.exp <= now() || !value.scope.includes(scope))
    throw new AppError(401, "Agent token expired or lacks permission.");
  return { ...(await activeGrant(value)), oauth: value };
}
export function metadata() {
  return {
    issuer: appOrigin(),
    authorization_endpoint: `${appOrigin()}/oauth/authorize`,
    token_endpoint: `${appOrigin()}/oauth/token`,
    registration_endpoint: `${appOrigin()}/oauth/register`,
    revocation_endpoint: `${appOrigin()}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: scopes,
    resource_indicators_supported: true,
  };
}
