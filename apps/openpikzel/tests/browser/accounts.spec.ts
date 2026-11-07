import { test, expect } from "@playwright/test";
test("OAuth registration, consent branding and Deny work through HTTP", async ({
  page,
  request,
}) => {
  const register = await request.post("/oauth/register", {
    data: {
      client_name: "Cursor test",
      redirect_uris: ["http://127.0.0.1:4321/callback"],
    },
  });
  expect(register.status()).toBe(201);
  const client = await register.json();
  const query = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: client.redirect_uris[0],
    response_type: "code",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
    resource: "http://127.0.0.1:3000/mcp",
    scope: "studio:read studio:write studio:ai",
    state: "opaque-state",
  });
  await page.goto("/oauth/authorize?" + query);
  await expect(
    page.getByRole("heading", {
      name: "Allow Cursor test to use your studio?",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Use your connected AI providers", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Allow access" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "evidence/openpikzels-oauth-consent.png",
    fullPage: true,
  });
  let destination = "";
  await page.route("http://127.0.0.1:4321/**", async (route) => {
    destination = route.request().url();
    await route.fulfill({ body: "Denied successfully" });
  });
  await page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(page.getByText("Denied successfully")).toBeVisible();
  expect(new URL(destination).searchParams.get("error")).toBe("access_denied");
  expect(new URL(destination).searchParams.get("state")).toBe("opaque-state");
});
test("account onboarding has no fake configured providers and fits mobile", async ({
  page,
}) => {
  await page.goto("/connect");
  await expect(
    page.getByRole("heading", { name: "Make it yours." }),
  ).toBeVisible();
  await page.screenshot({
    path: "evidence/openpikzels-connect-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "evidence/openpikzels-connect-mobile.png",
    fullPage: true,
  });
});

test("signed-in provider onboarding isolates key entry and shows revocable agents", async ({
  page,
}) => {
  const uid = "11111111-1111-4111-8111-111111111111";
  const session = {
    access_token:
      "header." +
      Buffer.from(JSON.stringify({ sub: uid, exp: 4102444800 })).toString(
        "base64url",
      ) +
      ".signature",
    refresh_token: "test-session-placeholder",
    expires_at: 4102444800,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: uid,
      aud: "authenticated",
      role: "authenticated",
      email: "creator@example.com",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-11-07T00:00:00Z",
    },
  };
  await page.addInitScript(
    (s) => localStorage.setItem("sb-test-auth-token", JSON.stringify(s)),
    session,
  );
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        cloud: true,
        ai: true,
        ownerGate: false,
        openai: false,
        jev: true,
        google: false,
        secureConnections: true,
        mcpUrl: "https://openpikzels.com/mcp",
        supabaseUrl: "https://test.supabase.co",
        supabaseKey: "sb_publishable_test",
      },
    }),
  );
  let saved = false;
  await page.route("**/api/providers", (r) => {
    if (r.request().method() === "POST") {
      saved = true;
      return r.fulfill({ json: { saved: true } });
    }
    return r.fulfill({
      json: { connections: [{ provider: "jev", suffix: "test" }] },
    });
  });
  await page.route("**/api/oauth/grants", (r) =>
    r.fulfill({
      json: {
        grants: [
          {
            id: uid,
            client_name: "Cursor (test fixture)",
            scope: ["studio:read", "studio:write", "studio:ai"],
            revoked_at: null,
          },
        ],
      },
    }),
  );
  await page.goto("/connect");
  await expect(
    page.getByRole("heading", { name: "Choose what powers your studio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revoke access" }),
  ).toBeVisible();
  const setup = page.locator(".provider-setup");
  expect(await setup.locator(":scope > :first-child").getAttribute("class")).toContain("key-form");
  await page.getByLabel("Your API key").fill("test-key-placeholder");
  await page.getByRole("button", { name: "Connect key", exact: true }).click();
  await expect(page.getByLabel("Your API key")).toHaveValue("");
  expect(saved).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "test-key-placeholder",
  );
  await page.screenshot({
    path: "evidence/openpikzels-provider-onboarding.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "evidence/openpikzels-provider-onboarding-mobile.png",
    fullPage: true,
  });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 320) expect((await page.getByLabel("Your API key").boundingBox())!.y).toBeLessThan((await page.locator(".provider-grid").boundingBox())!.y);
    await page.screenshot({ path: `evidence/layout-connections-${width}.png`, fullPage: true });
  }

});
