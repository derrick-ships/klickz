import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { unseal } from "../src/lib/crypto";
const state = vi.hoisted(() => ({ exists: false, written: null as any, oauth: false, listings: null as any, removed: false }));
vi.mock("../src/lib/server", async () => ({
 ...(await vi.importActual<any>("../src/lib/server")),
 authenticated: async () => ({ user: { id: "alice" }, oauth: state.oauth ? {} : undefined, db: {
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.exists ? { provider: "openai" } : null, error: null }) }), then: (resolve: any) => resolve({ data: state.listings ?? [{ provider: "openai", suffix: "test" }], error: null }) }) }), upsert: async (row: any) => { state.written = row; return { error: null }; }, delete: () => ({ eq: () => ({ eq: async () => { state.removed = true; return { error: null }; } }) }) })
 } })
}));
import { GET, POST, DELETE } from "../src/app/api/providers/route";
import { failure } from "../src/lib/server";
const request = (key: string, origin = "https://openpikzels.com", provider = "openai") => new Request("https://openpikzels.com/api/providers", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ provider, key }) });
beforeEach(() => { state.exists = false; state.written = null; state.oauth = false; state.listings = null; state.removed = false; vi.stubEnv("APP_ORIGIN", "https://openpikzels.com"); vi.stubEnv("STUDIO_ENCRYPTION_KEY", "c".repeat(64)); });
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

 it("saves, keeps and removes an anthropic key like openai, without leaking the key", async () => {
  const key = "sk-ant-test-0000FAKE";
  const logs: string[] = [];
  const capture = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  const spies = ["log","info","warn","error","debug"].map((name) => vi.spyOn(console, name as "log").mockImplementation(capture));
  try {
   const response = await POST(request(key, "https://openpikzels.com", "anthropic"));
   const body = await response.json();
   expect(body).toEqual({ saved: true });
   expect(JSON.stringify(body)).not.toContain(key);
   expect(JSON.stringify(state.written)).not.toContain(key);
   expect(state.written.provider).toBe("anthropic");
   expect(state.written.suffix).toBe("FAKE");
   expect(unseal(state.written.ciphertext, "provider:alice:anthropic")).toEqual({ key });
   expect(() => unseal(state.written.ciphertext, "provider:alice:openai")).toThrow();
   expect(() => unseal(state.written.ciphertext, "provider:bob:anthropic")).toThrow();
   state.listings = [{ provider: "anthropic", suffix: "FAKE" }];
   const listing = await GET(new Request("https://openpikzels.com/api/providers"));
   const listed = await listing.json();
   expect(listed).toEqual({ connections: [{ provider: "anthropic", suffix: "FAKE" }] });
   expect(JSON.stringify(listed)).not.toContain(key);
   state.exists = true;
   const kept = await POST(request("  ", "https://openpikzels.com", "anthropic"));
   expect(kept.status).toBe(200);
   expect(await kept.json()).toEqual({ saved: false, kept: true });
   const removed = await DELETE(new Request("https://openpikzels.com/api/providers", { method: "DELETE", headers: { origin: "https://openpikzels.com", "content-type": "application/json" }, body: JSON.stringify({ provider: "anthropic" }) }));
   expect(await removed.json()).toEqual({ removed: true });
   expect(state.removed).toBe(true);
   const failed = failure(new Error("provider refused sk-ant-test-0000FAKE"));
   const failText = await failed.text();
   expect(failText).not.toContain(key);
   expect(failText).not.toContain("provider refused");
   expect(failed.status).toBe(502);
   expect(logs.join("\n")).not.toContain(key);
  } finally {
   spies.forEach((spy) => spy.mockRestore());
  }
 });
 it("requires a real anthropic key for a new connection", async () => {
  expect((await POST(request("", "https://openpikzels.com", "anthropic"))).status).toBe(400);
  expect(state.written).toBeNull();
 });
});
