import { test, expect, type Page } from "@playwright/test";
const config = {cloud:true,ai:true,ownerGate:false,secureConnections:true,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test"};
const uid = "11111111-1111-4111-8111-111111111111";
const user = {id:uid,aud:"authenticated",role:"authenticated",email:"creator@example.com",app_metadata:{provider:"email"},user_metadata:{},created_at:"2026-11-07T00:00:00Z"};
const session = {access_token:"header."+Buffer.from(JSON.stringify({sub:uid,exp:4102444800})).toString("base64url")+".signature",refresh_token:"fixture",expires_at:4102444800,expires_in:3600,token_type:"bearer",user};
async function setup(page:Page) {
  await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
  await page.route("**/api/config",r=>r.fulfill({json:config}));
  await page.route("**/api/providers",r=>r.fulfill({json:{connections:[]}}));
  await page.route("**/api/oauth/grants",r=>r.fulfill({json:{grants:[]}}));
}
test.beforeEach(async({page})=>setup(page));
test("email-first flow snapshots recipient, prevents repeats and supports changing email",async({page})=>{
  await page.clock.install();
  const sent:unknown[]=[];
  await page.route("https://test.supabase.co/auth/v1/otp**",async r=>{sent.push(r.request().postDataJSON());await r.fulfill({json:{}});});
  await page.goto("/connect");
  await expect(page.getByLabel("Password",{exact:true})).toHaveCount(0);
  await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
  await page.getByRole("button",{name:"Email me a sign-in link",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Check your email"})).toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"Open the sign-in link"})).toBeVisible();
  await expect(page.getByLabel("Email",{exact:true})).toHaveAttribute("readonly","");
  await expect(page.getByRole("button",{name:/Send again in/})).toBeDisabled();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({email:"creator@example.com"});
  await page.getByLabel("Email sign-in code",{exact:true}).fill("123456");
  await page.getByRole("button",{name:"Change email",exact:true}).click();
  await expect(page.getByLabel("Email",{exact:true})).toBeFocused();
  await expect(page.getByLabel("Email sign-in code",{exact:true})).toHaveCount(0);
  await page.getByLabel("Email",{exact:true}).fill("second@example.com");
  await page.clock.fastForward(61_000);
  await page.getByRole("button",{name:"Email me a sign-in link",exact:true}).click();
  await expect.poll(() => sent.length).toBe(2);
  await expect(page.getByLabel("Email sign-in code",{exact:true})).toHaveValue("");
  expect(sent[1]).toMatchObject({email:"second@example.com"});
});
test("email failure stays recoverable and does not claim delivery",async({page})=>{
  await page.route("https://test.supabase.co/auth/v1/otp**",r=>r.fulfill({status:500,json:{message:"fixture provider text"}}));
  await page.goto("/connect");
  await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
  await page.getByRole("button",{name:"Email me a sign-in link",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Could not send"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Check your email"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Email me a sign-in link",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Use password instead",exact:true}).click();
  await expect(page.getByLabel("Email",{exact:true})).toHaveValue("creator@example.com");
  await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
});
test("password fallback and new-account route remain available",async({page})=>{
  await page.route("https://test.supabase.co/auth/v1/token**",r=>r.fulfill({status:400,json:{error_code:"invalid_credentials",msg:"Invalid"}}));
  await page.goto("/connect");
  await page.getByRole("button",{name:"Use password instead",exact:true}).click();
  await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
  await page.getByLabel("Password",{exact:true}).fill("fixture-password");
  await expect(page.getByLabel("Email",{exact:true})).toHaveValue("creator@example.com");
  await expect(page.getByLabel("Password",{exact:true})).toHaveValue("fixture-password");
  await page.getByRole("button",{name:"Sign in with password",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Sign-in failed"})).toBeVisible();
  await expect(page.getByLabel("Password",{exact:true})).toHaveValue("");
  await page.getByRole("button",{name:"Create an account with a password",exact:true}).click();
  await expect(page.getByLabel("Password (at least 8 characters)",{exact:true})).toHaveAttribute("minlength","8");
  await page.getByRole("button",{name:"Use an email link instead",exact:true}).click();
  await expect(page.getByLabel("Email",{exact:true})).toHaveValue("creator@example.com");
});
test("expired email link has inline recovery and cleans error URL",async({page})=>{
  await page.goto("/connect#error=access_denied&error_code=otp_expired&error_description=UNTRUSTED");
  await expect(page.getByRole("status").filter({hasText:"expired or was already used"})).toBeVisible();
  await expect(page.getByLabel("Email",{exact:true})).toHaveAccessibleDescription(/expired/);
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator("body")).not.toContainText("UNTRUSTED");
  await expect(page.getByRole("button",{name:"Email me a sign-in link",exact:true})).toBeEnabled();
});
test("successful magic link is consumed by SDK and opens connected account",async({page})=>{
  await page.route("https://test.supabase.co/auth/v1/user**",r=>r.fulfill({json:user}));
  const hash=new URLSearchParams({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:"3600",token_type:"bearer",type:"magiclink"});
  await page.goto("/connect#"+hash);
  await expect(page.getByRole("heading",{name:"Connect an API provider",exact:true})).toBeVisible();
  await expect.poll(()=>new URL(page.url()).hash).toBe("");
  await expect(page.getByRole("button",{name:"Sign out",exact:true})).toBeVisible();
});
test("agent consent uses codes and does not consume the studio session",async({page})=>{
  await page.addInitScript(s=>localStorage.setItem("sb-test-auth-token",JSON.stringify(s)),session);
  await page.route("**/api/oauth/consent?**",r=>r.fulfill({json:{name:"Fixture agent",redirect:"https://example.com/callback",scope:["studio:read"]}}));
  await page.route("https://test.supabase.co/auth/v1/otp**",r=>r.fulfill({json:{}}));
  await page.route("https://test.supabase.co/auth/v1/verify**",r=>r.fulfill({json:session}));
  await page.goto("/oauth/consent?request=fixture");
  await expect(page.getByRole("button",{name:"Allow access",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Email me a sign-in link",exact:true})).toHaveCount(0);
  await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
  await page.getByRole("button",{name:"Email me a sign-in code",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"finish connecting this agent"})).toBeVisible();
  await page.getByLabel("Email sign-in code",{exact:true}).fill("123456");
  await page.getByRole("button",{name:"Verify code",exact:true}).click();
  await expect(page.getByRole("button",{name:"Allow access",exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("sb-test-auth-token")!).refresh_token)).toBe("fixture");
});
test("sign-in fits small screens, keyboard use and reduced motion",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.route("https://test.supabase.co/auth/v1/otp**",r=>r.fulfill({json:{}}));
  for(const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto("/connect");
    await expect(page.getByRole("heading",{name:"Sign in to OpenPikzels",exact:true})).toBeVisible();
    await page.screenshot({path:"evidence/sign-in-entry-"+width+".png",fullPage:true});
    await page.getByLabel("Email",{exact:true}).fill("creator@example.com");
    await page.getByLabel("Email",{exact:true}).press("Tab");
    await expect(page.getByRole("button",{name:"Email me a sign-in link",exact:true})).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Email sign-in code",{exact:true})).toBeFocused();
    await page.screenshot({path:"evidence/sign-in-sent-"+width+".png",fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for(const box of await page.locator(".signin-form button:visible").all()){
      expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("studio code sign-in continues to API setup and preserves the local direction",async({page})=>{
 await page.route("https://test.supabase.co/auth/v1/verify**",r=>r.fulfill({json:session}));
 await page.route("https://test.supabase.co/auth/v1/user**",r=>r.fulfill({json:user}));
 await page.route("https://test.supabase.co/rest/v1/**",r=>r.fulfill({json:[]}));
 await page.goto("/studio");
 await page.getByLabel("Describe your thumbnail",{exact:true}).fill("Preserve this local direction during sign-in");
 await page.getByRole("button",{name:"Sign in to generate",exact:true}).click();
 const dialog=page.getByRole("dialog");
 await dialog.getByLabel("Email",{exact:true}).fill("creator@example.com");
 await dialog.getByRole("button",{name:"I already have a code",exact:true}).click();
 await dialog.getByLabel("Email sign-in code",{exact:true}).fill("123456");
 await dialog.getByRole("button",{name:"Verify code",exact:true}).click();
 await expect(page).toHaveURL(/\/connect#api$/);
 await expect(page.getByRole("heading",{name:"Connect an API provider",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("openpikzels.draftCheckpoint.local")!).draft.prompt)).toBe("Preserve this local direction during sign-in");
});
