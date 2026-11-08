import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { unseal } from "../src/lib/crypto";
const state = vi.hoisted(() => ({ exists: false, written: null as any, oauth: false }));
vi.mock("../src/lib/server", async () => ({
 ...(await vi.importActual<any>("../src/lib/server")),
 authenticated: async () => ({ user: { id: "alice" }, oauth: state.oauth ? {} : undefined, db: {
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.exists ? { provider: "openai" } : null, error: null }) }), then: (resolve: any) => resolve({ data: [{ provider: "openai", suffix: "test" }], error: null }) }) }), upsert: async (row: any) => { state.written = row; return { error: null }; } })
 } })
}));
import { GET, POST } from "../src/app/api/providers/route";
const request = (key: string, origin = "https://openpikzels.com") => new Request("https://openpikzels.com/api/providers", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ provider: "openai", key }) });
beforeEach(() => { state.exists = false; state.written = null; state.oauth = false; vi.stubEnv("APP_ORIGIN", "https://openpikzels.com"); vi.stubEnv("STUDIO_ENCRYPTION_KEY", "c".repeat(64)); });
afterEach(() => vi.unstubAllEnvs());
describe("write-only provider connections", () => {
 it("keeps an existing key when the form is blank, without replacing ciphertext", async () => {
  state.exists = true; const response = await POST(request("  "));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ saved: false, kept: true }); expect(state.written).toBeNull();
 });
 it("requires a real key for a new connection", async () => { expect((await POST(request(""))).status).toBe(400); expect(state.written).toBeNull(); });
 it("returns no key and stores only purpose-bound ciphertext plus a suffix", async () => {
  const key = "synthetic-api-key-only-for-this-test"; const response = await POST(request(key));
  expect(await response.json()).toEqual({ saved: true }); expect(JSON.stringify(state.written)).not.toContain(key);
  expect(unseal(state.written.ciphertext, "provider:alice:openai")).toEqual({ key });
  expect(() => unseal(state.written.ciphertext, "provider:bob:openai")).toThrow();
  const listing = await GET(new Request("https://openpikzels.com/api/providers")); expect(await listing.json()).toEqual({ connections: [{ provider: "openai", suffix: "test" }] });
 });
 it("rejects external-origin writes and agent attempts to manage secrets", async () => {
  expect((await POST(request("synthetic-test-key", "https://other.example"))).status).toBe(403);
  state.oauth = true; expect((await POST(request("synthetic-test-key"))).status).toBe(403);
  expect((await GET(new Request("https://openpikzels.com/api/providers"))).status).toBe(403);
 });
});
