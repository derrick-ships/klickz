import { test, expect, type Page } from "@playwright/test";
const uid = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page) {
  const session = { access_token: "header." + Buffer.from(JSON.stringify({ sub: uid, exp: 4102444800 })).toString("base64url") + ".signature", refresh_token: "fixture-only", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id: uid, aud: "authenticated", role: "authenticated", email: "fixture@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-11-08T00:00:00Z" } };
  await page.addInitScript((s) => { localStorage.setItem("sb-test-auth-token", JSON.stringify(s)); }, session);
  await page.route("**/api/config", (r) => r.fulfill({ json: { cloud: true, secureConnections: true, supabaseUrl: "https://test.supabase.co", supabaseKey: "sb_publishable_test" } }));
  await page.route("**/api/providers", (r) => r.fulfill({ json: { connections: [{ provider: "openai", suffix: "abcd" }, { provider: "jev", suffix: "wxyz" }] } }));
  await page.route("**/api/oauth/grants", (r) => r.fulfill({ json: { grants: [] } }));
}

test("Settings → Models saves each job's model and shows what 'latest' resolves to", async ({ page }) => {
  await setup(page);
  const saves: any[] = [];
  await page.route("**/api/models", async (r) => {
    if (r.request().method() === "PUT") { saves.push(r.request().postDataJSON()); return r.fulfill({ json: { models: r.request().postDataJSON() } }); }
    return r.fulfill({ json: { models: { reviewer: "auto", scorer: "jev", mediator: "auto", image: "flare" }, resolved: { "gpt-sol-latest": "gpt-6.1-sol", "gpt-terra-latest": "gpt-6.1-terra", "gpt-luna-latest": "gpt-6-luna" } } });
  });
  await page.goto("/connect#models");
  const panel = page.locator("#models");
  await expect(panel.getByRole("heading", { name: "Models" })).toBeVisible();
  const reviewer = panel.getByLabel("Reviewer", { exact: true });
  await expect(reviewer.locator("option", { hasText: "GPT Sol · gpt-6.1-sol" })).toHaveCount(1);
  await expect(reviewer.locator("option", { hasText: "Claude Opus · not connected" })).toHaveAttribute("disabled", "");
  await reviewer.selectOption("gpt-sol-latest");
  await panel.getByLabel("Scorer", { exact: true }).selectOption("model");
  await expect(panel.getByRole("status")).toHaveText("Saved");
  expect(saves.at(-1)).toEqual({ reviewer: "gpt-sol-latest", scorer: "model", mediator: "auto", image: "flare" });
  await expect(panel.getByLabel("Prompt writer", { exact: true }).locator("option", { hasText: "Claude" })).toHaveCount(0);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await panel.screenshot({ path: `evidence/models-settings-${width}.png` });
  }
});
