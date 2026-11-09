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
    page.getByRole("heading", { name: "Connect your AI" }),
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
        higgsfield: true,
        mcpUrl: "https://openpikzels.com/mcp",
        supabaseUrl: "https://test.supabase.co",
        supabaseKey: "sb_publishable_test",
      },
    }),
  );
  await page.route("**/api/connections/higgsfield", r => r.fulfill({ json: { connected: false } }));
  let saved = false; let kept = false;
  await page.route("**/api/providers", (r) => {
    if (r.request().method() === "POST") {
      if (!r.request().postDataJSON().key) { kept = true; return r.fulfill({ json: { kept: true, saved: false } }); }
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
    page.getByRole("heading", { name: "Connect an API provider" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revoke access" }),
  ).toBeVisible();
  const setup = page.locator(".provider-setup");
  expect(await setup.locator(":scope > :first-child").getAttribute("class")).toContain("key-form");
  await expect(page.locator(".provider-key-guide")).toContainText("It is not your password");
  await expect(page.locator("#provider-key-cost")).toContainText("Saving a key makes no billable test request");
  for (const [provider, name, host] of [["openai", "OpenAI", "developers.openai.com"], ["google", "Google", "ai.google.dev"], ["jev", "Jev AI", "docs.typesafe.ai"], ["youtube", "YouTube", "developers.google.com"]]) {
    await page.getByLabel("Provider", {exact:true}).selectOption(provider);
    const guide = page.locator(".provider-key-guide");
    const summary = guide.locator("summary"); await summary.focus(); await page.keyboard.press("Enter");
    await expect(guide.locator("details")).toHaveAttribute("open", "");
    expect(new URL((await guide.getByRole("link").getAttribute("href"))!).hostname).toBe(host);
    await expect(guide.getByRole("link")).toContainText(name);
    await expect(guide.locator("li")).toHaveCount(3);
  }
  await page.getByLabel("Provider", {exact:true}).selectOption("openai");
  await page.getByLabel("Your API key").fill("test-key-placeholder");
  await page.getByRole("button", { name: "Connect key", exact: true }).click();
  await expect(page.getByLabel("Your API key")).toHaveValue("");
  expect(saved).toBe(true);
  await page.getByLabel("Provider", { exact: true }).selectOption("jev");
  await expect(page.getByLabel("Your API key")).toHaveAttribute("placeholder", "Leave empty to keep current key");
  await page.getByRole("button", { name: "Save connection", exact: true }).click();
  await expect(page.getByText("Your saved key is unchanged.", { exact: true })).toBeVisible();
  expect(kept).toBe(true);
  await page.getByLabel("Your API key").fill("unsaved-secret-placeholder");
  await page.getByLabel("Provider", { exact: true }).selectOption("google");
  await expect(page.getByLabel("Your API key")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Connect Higgsfield", exact: true })).toBeVisible();
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
  await expect(page.getByRole("link", {name:"Continue with a free draft", exact:true})).toHaveAttribute("href", "/studio");
  await page.locator(".provider-key-guide summary").click();
  await page.locator(".provider-key-guide").scrollIntoViewIfNeeded();
  await page.screenshot({path:"evidence/loop-v2-provider-guide-mobile.png"});
  await page.locator(".provider-key-guide summary").click();

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 320) expect((await page.getByLabel("Your API key").boundingBox())!.y).toBeLessThan((await page.locator(".provider-grid").boundingBox())!.y);
    await page.screenshot({ path: `evidence/layout-connections-${width}.png`, fullPage: true });
  }

  let externalConnected = false;
  await page.route("**/api/connections/higgsfield", async route => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      expect(input.action).toBe("finish"); expect(input.code).toBe("synthetic-code"); expect(input.state).toBe(uid);
      externalConnected = true;
    } else if (route.request().method() === "DELETE") externalConnected = false;
    await route.fulfill({ json: { connected: externalConnected } });
  });
  await page.route("**/api/connections/higgsfield?check=true", route => route.fulfill({ json: { tools: [{ name: "fixture_read_assets" }] } }));
  await page.goto("/connect?code=synthetic-code&state=" + uid);
  await expect(page.getByText("Higgsfield is connected.", { exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: "Check Higgsfield connection", exact: true }).click();
  await page.getByText("Available Higgsfield tools (1)", { exact: true }).click();
  await expect(page.getByText("fixture_read_assets", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disconnect Higgsfield", exact: true }).click();
  await expect(page.getByText("Higgsfield is not connected.", { exact: true })).toBeVisible();

});

test("email-code sign-in stays on the page and keeps password fallback", async ({ page }) => {
 await page.route("**/api/config", route => route.fulfill({json:{cloud:true,ai:true,ownerGate:false,secureConnections:true,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test",mcpUrl:"https://openpikzels.com/mcp"}}));
 await page.route("https://test.supabase.co/auth/v1/otp**", route => route.fulfill({json:{}}));
 await page.goto("/connect");
 await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
 await page.getByRole("button",{name:"Email me a sign-in code",exact:true}).click();
 await expect(page.getByLabel("Email sign-in code",{exact:true})).toBeFocused();
 await expect(page.getByLabel("Password",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Verify code",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Use password instead",exact:true}).click();
 await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole("button",{name:"Email me a sign-in code",exact:true}).click();
 await page.screenshot({path:"evidence/activation-email-code-390.png",fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});


test("email limits preserve access to an already received code", async ({ page }) => {
 await page.route("**/api/config", route => route.fulfill({json:{cloud:true,ai:true,ownerGate:false,secureConnections:true,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test",mcpUrl:"https://openpikzels.com/mcp"}}));
 let emails=0;
 await page.route("https://test.supabase.co/auth/v1/otp**", route => { emails++; return route.fulfill({status:429,json:{code:"over_email_send_rate_limit",msg:"email rate limit exceeded"}}); });
 await page.goto("/connect"); await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
 await page.getByRole("button",{name:"I already have a code",exact:true}).click();
 await expect(page.getByLabel("Email sign-in code",{exact:true})).toBeFocused(); expect(emails).toBe(0);
 await page.getByRole("button",{name:"Use password instead",exact:true}).click();
 await page.getByRole("button",{name:"Email me a sign-in code",exact:true}).click();
 await expect(page.getByRole("status").filter({ hasText: "email limit has been reached" })).toBeVisible();
 await expect(page.getByLabel("Email sign-in code",{exact:true})).toBeFocused(); expect(emails).toBe(1);
});


test("local companion setup offers a real source download and fits mobile", async ({ page, request }) => {
 await page.goto("/local-companion");
 await expect(page.getByRole("heading", {name:"Your plan. On your computer."})).toBeVisible();
 await expect(page.getByRole("link",{name:"Open installed companion",exact:true})).toHaveAttribute("href","http://127.0.0.1:48763");
 const archive=await request.get("/downloads/openpikzels-local-companion.zip");
 expect(archive.status()).toBe(200);
 expect((await archive.body()).subarray(0,2).toString()).toBe("PK");
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:"evidence/local-companion-guide-390.png",fullPage:true});
});

test("invalid email code stays editable with nearby associated feedback",async({page})=>{
 await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
 await page.route("**/api/config",r=>r.fulfill({json:{cloud:true,ai:true,ownerGate:false,secureConnections:true,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test"}}));
 await page.route("https://test.supabase.co/auth/v1/verify**",r=>r.fulfill({status:403,json:{code:"otp_expired",msg:"Token has expired or is invalid"}}));
 await page.route("https://test.supabase.co/auth/v1/otp**",r=>r.fulfill({json:{}}));
 await page.goto("/connect");await page.getByLabel("Email",{exact:true}).fill("creator@example.test");await page.getByRole("button",{name:"I already have a code",exact:true}).click();
 const code=page.getByLabel("Email sign-in code",{exact:true});await code.fill("123456");await page.getByRole("button",{name:"Verify code",exact:true}).click();
 await expect(code).toHaveValue("123456");await expect(code).toHaveAttribute("aria-invalid","true");await expect(code).toHaveAccessibleDescription(/could not be verified/);
 const error=page.getByRole("status").filter({hasText:"That code could not be verified"});await expect(error).toBeVisible();
 expect((await error.boundingBox())!.y).toBeLessThan((await page.getByRole("button",{name:"Verify code",exact:true}).boundingBox())!.y);
 await page.getByRole("button",{name:"Send a new sign-in code",exact:true}).click();await expect(code).toHaveValue("");await expect(code).not.toHaveAttribute("aria-invalid","true");
});