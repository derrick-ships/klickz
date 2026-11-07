import { describe, it, expect, vi, afterEach } from "vitest";
import { authenticated, requireAI, failure } from "../src/lib/server";
import { GET } from "../src/app/api/config/route";
afterEach(() => vi.unstubAllEnvs());
describe("authentication and server-only secrets", () => {
  it("requires an authenticated bearer session before cloud work", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    await expect(
      authenticated(new Request("http://localhost/api/generate")),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("blocks provider usage unless explicitly enabled", () => {
    vi.stubEnv("AI_ENABLED", "false");
    vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
    expect(() => requireAI("openai")).toThrow("AI usage is disabled");
  });
  it("never exposes provider secrets and rejects Supabase secret keys in public config", async () => {
    vi.stubEnv("OPENAI_API_KEY", "private-provider-placeholder");
    vi.stubEnv("JEV_API_KEY", "private-jev-placeholder");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_secret_private-placeholder",
    );
    const config = await GET().json();
    expect(config.cloud).toBe(false);
    expect(config.supabaseKey).toBe("");
    expect(JSON.stringify(config)).not.toContain("private-");
  });
  it("sanitizes upstream error details", async () => {
    const response = failure(new Error("private-provider-placeholder"));
    expect(await response.text()).not.toContain("private-provider-placeholder");
    expect(response.status).toBe(502);
  });
});
