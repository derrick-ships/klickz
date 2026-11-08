import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { seal } from "../src/lib/crypto";
const fixture = vi.hoisted(() => ({ code: "", delivered: false }));
vi.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({ auth: async (provider: any, options: any) => {
 if (!options.authorizationCode) {
  provider.saveClientInformation({ client_id: "synthetic-client", issuer: "https://clerk.higgsfield.ai" });
  provider.saveCodeVerifier("fixture-pkce-verifier");
  provider.redirectToAuthorization(new URL("https://clerk.higgsfield.ai/oauth/authorize?state=" + await provider.state()));
  return "REDIRECT";
 }
 fixture.code = options.authorizationCode;
 expect(provider.codeVerifier()).toBe("fixture-pkce-verifier");
 await provider.saveTokens({ access_token: "synthetic-higgsfield-token", token_type: "Bearer" }); return "AUTHORIZED";
} }));
import { startHiggsfield, finishHiggsfield, higgsfieldFetch } from "../src/lib/higgsfield";
const rows = new Map<string, any>(), connections: any[] = [];
function database() { return { from: (table: string) => {
 let operation = "", filters: any = {}, selected = false;
 const chain: any = { delete: () => { operation = "delete"; return chain; }, eq: (k: string,v: string) => { filters[k]=v; return chain; }, gt: () => chain,
 select: () => { selected=true; return chain; }, maybeSingle: async () => {
  const row = rows.get(filters.id); if (!row || row.user_id!==filters.user_id) return { data:null,error:null };
  if (operation==='delete') rows.delete(filters.id);
  return { data:{ciphertext:row.ciphertext},error:null };
 }, insert: async (row: any) => { rows.set(row.id,row); return {error:null}; }, upsert: async (row: any) => { connections.push(row); return {error:null}; },
 then: (resolve: any) => { if(operation==='delete'&&!selected) for(const [id,row] of rows) if(row.user_id===filters.user_id)rows.delete(id);return Promise.resolve({error:null}).then(resolve); } };
 return chain;
 } } as any; }
beforeEach(() => { rows.clear(); connections.length=0; fixture.code=""; vi.stubEnv("APP_ORIGIN","https://openpikzels.com"); vi.stubEnv("STUDIO_ENCRYPTION_KEY","d".repeat(64)); });
afterEach(() => vi.unstubAllEnvs());
describe("Higgsfield OAuth state and token isolation", () => {
 it("completes a bound single-use sign-in without returning tokens", async () => {
  const db=database(), started=await startHiggsfield(db,"alice"), state=new URL(started.authorizationUrl).searchParams.get("state")!;
  expect(JSON.stringify([...rows.values()])).not.toContain("fixture-pkce-verifier");
  const finished=await finishHiggsfield(db,"alice",state,"fixture-code");expect(finished).toEqual({connected:true});
  expect(JSON.stringify(connections)).not.toContain("synthetic-higgsfield-token");
  await expect(finishHiggsfield(db,"alice",state,"fixture-code")).rejects.toThrow("already used");
 });
 it("rejects another user's sign-in state without consuming it", async () => {
  const db=database(), started=await startHiggsfield(db,"alice"), state=new URL(started.authorizationUrl).searchParams.get("state")!;
  await expect(finishHiggsfield(db,"bob",state,"fixture-code")).rejects.toThrow();expect(rows.has(state)).toBe(true);expect(connections).toHaveLength(0);
  await finishHiggsfield(db,"alice",state,"fixture-code");expect(connections[0].user_id).toBe("alice");
 });
 it("refuses private or unrelated endpoints before making a network request", async () => {
  for(const u of ["http://127.0.0.1/private","https://other.example/token","https://user:password@clerk.higgsfield.ai/oauth/token"])await expect(higgsfieldFetch(u)).rejects.toThrow("unsupported");
 });
});
