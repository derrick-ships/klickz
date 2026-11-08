import { randomUUID } from "node:crypto";
import { auth, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthTokens, OAuthClientInformationMixed } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appOrigin, seal, unseal } from "./crypto";
import { AppError } from "./validation";
export const higgsfieldUrl = "https://mcp.higgsfield.ai/mcp";
export const higgsfieldMetadata = () => ({
 client_id: `${appOrigin()}/integrations/higgsfield/client.json`, client_name: "OpenPikzels",
 client_uri: appOrigin(), redirect_uris: [`${appOrigin()}/connect`],
 grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none",
});
type Connection = { client?: OAuthClientInformationMixed; tokens?: OAuthTokens; verifier?: string; state?: string };
const purpose = (uid: string) => `external:${uid}:higgsfield`;
export const higgsfieldFetch: typeof fetch = async (input, init) => {
 const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
 if (url.protocol !== "https:" || url.username || url.password || !["mcp.higgsfield.ai", "clerk.higgsfield.ai"].includes(url.hostname)) throw new AppError(400, "Higgsfield returned an unsupported authentication endpoint.");
 return fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(20000) });
};
function provider(data: Connection, onRedirect: (url: string) => void, save: () => Promise<void>): OAuthClientProvider {
 return {
  redirectUrl: `${appOrigin()}/connect`, clientMetadataUrl: `${appOrigin()}/integrations/higgsfield/client.json`,
  clientMetadata: higgsfieldMetadata(), state: () => data.state!,
  clientInformation: () => data.client, saveClientInformation: (client) => { data.client = client; },
  tokens: () => data.tokens, saveTokens: async (tokens) => { data.tokens = tokens; await save(); },
  redirectToAuthorization: (url) => {
   if (url.origin !== "https://clerk.higgsfield.ai") throw new AppError(400, "Unexpected Higgsfield sign-in destination.");
   onRedirect(url.href);
  },
  saveCodeVerifier: (verifier) => { data.verifier = verifier; }, codeVerifier: () => {
   if (!data.verifier) throw new AppError(400, "Restart the Higgsfield connection."); return data.verifier;
  },
  invalidateCredentials: (scope) => {
   if (scope === "all" || scope === "tokens") delete data.tokens;
   if (scope === "all" || scope === "client") delete data.client;
  },
 };
}
export async function startHiggsfield(db: SupabaseClient, uid: string) {
 const id = randomUUID(), data: Connection = { state: id }; let url = "";
 await auth(provider(data, value => { url = value; }, async () => {}), { serverUrl: higgsfieldUrl, scope: "openid email offline_access", fetchFn: higgsfieldFetch });
 if (!url) throw new AppError(503, "Higgsfield sign-in could not start. Try again.");
 await db.from("studio_connection_sessions").delete().eq("user_id", uid).eq("provider", "higgsfield");
 const inserted = await db.from("studio_connection_sessions").insert({ id, user_id: uid, provider: "higgsfield", ciphertext: seal(data, purpose(uid)), expires_at: new Date(Date.now()+600000).toISOString() });
 if (inserted.error) throw new AppError(503, "Could not save the private sign-in request.");
 return { authorizationUrl: url };
}
export async function finishHiggsfield(db: SupabaseClient, uid: string, state: string, code: string) {
 // DELETE RETURNING atomically consumes state before the code is exchanged.
 const pending = await db.from("studio_connection_sessions").delete().eq("id", state).eq("user_id", uid).eq("provider", "higgsfield").gt("expires_at", new Date().toISOString()).select("ciphertext").maybeSingle();
 if (pending.error || !pending.data) throw new AppError(400, "This Higgsfield sign-in expired or was already used. Connect again.");
 const data = unseal<Connection>(pending.data.ciphertext, purpose(uid));
 if (data.state !== state) throw new AppError(400, "Invalid sign-in state.");
 const result = await auth(provider(data, () => { throw new AppError(400, "Restart Higgsfield sign-in."); }, async () => {}), { serverUrl: higgsfieldUrl, authorizationCode: code, fetchFn: higgsfieldFetch });
 if (result !== "AUTHORIZED" || !data.tokens?.access_token) throw new AppError(400, "Higgsfield did not complete authorization.");
 delete data.verifier; delete data.state;
 const saved = await db.from("studio_external_connections").upsert({ user_id: uid, provider: "higgsfield", ciphertext: seal(data, purpose(uid)), updated_at: new Date().toISOString(), lease_id: null, lease_until: null });
 if (saved.error) throw new AppError(503, "Could not save the Higgsfield connection. Connect again.");
 return { connected: true };
}
export async function higgsfieldTools(db: SupabaseClient, uid: string) {
 const lease = randomUUID();
 const locked = await db.from("studio_external_connections").update({ lease_id: lease, lease_until: new Date(Date.now()+60000).toISOString() }).eq("user_id", uid).eq("provider", "higgsfield").or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`).select("ciphertext").maybeSingle();
 if (locked.error) throw new AppError(503, "Could not load the Higgsfield connection.");
 if (!locked.data) throw new AppError(409, "Connect Higgsfield first, or wait for the current connection check to finish.");
 const data = unseal<Connection>(locked.data.ciphertext, purpose(uid));
 const client = new Client({ name: "OpenPikzels", version: "1.0.0" });
 const authProvider = provider(data, () => { throw new AppError(401, "Reconnect Higgsfield in Connections."); }, async () => {
  const saved = await db.from("studio_external_connections").update({ ciphertext: seal(data, purpose(uid)), updated_at: new Date().toISOString() }).eq("user_id", uid).eq("provider", "higgsfield").eq("lease_id", lease);
  if (saved.error) throw new AppError(503, "Could not refresh the Higgsfield connection.");
 });
 try {
  const transport = new StreamableHTTPClientTransport(new URL(higgsfieldUrl), { authProvider, fetch: higgsfieldFetch });
  await client.connect(transport); const result = await client.listTools();
  return { tools: result.tools.map(t => ({ name: t.name, description: t.description })), hasMore: !!result.nextCursor };
 } finally {
  await client.close().catch(() => {});
  await db.from("studio_external_connections").update({ lease_id: null, lease_until: null }).eq("user_id", uid).eq("provider", "higgsfield").eq("lease_id", lease);
 }
}
