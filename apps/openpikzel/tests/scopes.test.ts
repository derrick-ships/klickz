import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("../src/lib/oauth/core", async () => ({
  ...(await vi.importActual<any>("../src/lib/oauth/core")),
  resolveAccess: async () => ({
    db: {},
    user: { id: "11111111-1111-4111-8111-111111111111" },
    oauth: { scope: ["studio:read", "studio:ai"] },
  }),
}));
import { POST as generate } from "../src/app/api/generate/route";
import { POST as analyze } from "../src/app/api/analyze/route";
import { POST as prepare } from "../src/app/api/persona/prepare/route";
import { POST as creative } from "../src/app/api/creative/route";
import { POST as resize } from "../src/app/api/resize/route";
import { AppError } from "../src/lib/validation";
import { requireScope, scopeCopy, scopes } from "../src/lib/oauth/core";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  ["generate", generate],
  ["analyze", analyze],
  ["prepare", prepare],
  ["resize", resize],
  ["creative", creative],
])(
  "rejects direct %s HTTP calls when an AI grant lacks write permission",
  async (name, handler) => {
    const r = await handler(
      new Request("https://openpikzels.com/api/" + name, {
        method: "POST",
        headers: {
          Authorization: "Bearer opz1.placeholder",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/permission/);
  },
);

it("includes studio:agent and the exact local-agent consent copy", () => {
  expect(scopes).toContain("studio:agent");
  expect(scopeCopy["studio:agent"].heading).toBe(
    "Let your local agent keep memory and send you cards",
  );
});

it("rejects a token without studio:agent with 403 from the scope guard", () => {
  try {
    requireScope({ scope: ["studio:read", "studio:ai"] }, "studio:agent");
    throw new Error("expected requireScope to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(403);
    expect((error as AppError).message).toMatch(/permission/);
  }
});
