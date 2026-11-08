import {test,expect,type Page} from "@playwright/test";
const uid="11111111-1111-4111-8111-111111111111",attempt="33333333-3333-4333-8333-333333333333";
async function setup(page:Page){
 const session={access_token:"header."+Buffer.from(JSON.stringify({sub:uid,exp:4102444800})).toString("base64url")+".signature",refresh_token:"fixture-only",expires_at:4102444800,expires_in:3600,token_type:"bearer",user:{id:uid,aud:"authenticated",role:"authenticated",email:"fixture@example.com",app_metadata:{provider:"email"},user_metadata:{},created_at:"2026-11-08T00:00:00Z"}};
 await page.addInitScript(s=>{localStorage.setItem("sb-test-auth-token",JSON.stringify(s));window.open=()=>null;},session);
 await page.route("**/api/config",r=>r.fulfill({json:{cloud:true,codexDevice:true,secureConnections:true,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test"}}));
 await page.route("**/api/providers",r=>r.fulfill({json:{connections:[]}}));
 await page.route("**/api/oauth/grants",r=>r.fulfill({json:{grants:[]}}));
}
const waiting=()=>({connected:false,phase:"waiting_device",attemptId:attempt,userCode:"TEST-CODE",expiresAt:new Date(Date.now()+600000).toISOString(),pollAfter:5});
test("device flow works with blocked popup, completes, reads metadata and disconnects",async({page})=>{
 await setup(page);let polls=0;
 await page.route("**/api/connections/codex",r=>{
  if(r.request().method()==="GET"||r.request().method()==="DELETE")return r.fulfill({json:{connected:false,phase:"idle"}});
  const action=r.request().postDataJSON().action;
  if(action==="start")return r.fulfill({json:waiting()});
  if(action==="poll"){polls++;return r.fulfill({json:{connected:true,phase:"connected",label:"f•••@example.com",plan:"plus"}});}
  return r.fulfill({json:{connected:true,phase:"connected",label:"f•••@example.com",checkedAt:new Date().toISOString(),usageAvailable:true,modelsAvailable:true,windows:[{kind:"session",usedPercent:12}],models:[{id:"fixture-model",name:"Fixture model"}]}});
 });
 await page.goto("/connect#chatgpt");await page.getByRole("button",{name:"Continue with ChatGPT",exact:true}).click();
 await expect(page.getByLabel("One-time sign-in code")).toHaveText("TEST-CODE");
 await expect(page.getByRole("link",{name:"Open OpenAI sign-in",exact:true})).toHaveAttribute("href","https://auth.openai.com/codex/device");
 await page.screenshot({path:"evidence/codex-device-desktop.png",fullPage:true});
 await expect(page.getByText("ChatGPT connected. No generation request was made.")).toBeVisible({timeout:10000});expect(polls).toBe(1);
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain("TEST-CODE");
 await page.getByRole("button",{name:"Refresh usage and models"}).click();await expect(page.getByText("session: 12% used")).toBeVisible();
 await page.getByRole("button",{name:"Disconnect ChatGPT",exact:true}).click();await expect(page.getByRole("button",{name:"Continue with ChatGPT",exact:true})).toBeVisible();
});
test("cancel suppresses late completion; mobile and reduced motion remain usable",async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});let release:()=>void=()=>{};let started=false;
 await page.route("**/api/connections/codex",async r=>{
  if(r.request().method()==="GET")return r.fulfill({json:{connected:false,phase:"idle"}});
  const action=r.request().postDataJSON().action;
  if(action==="start")return r.fulfill({json:waiting()});
  if(action==="cancel")return r.fulfill({json:{connected:false,phase:"cancelled"}});
  started=true;await new Promise<void>(resolve=>{release=resolve;});await r.fulfill({json:{connected:true,phase:"connected",label:"late@example.com"}});
 });
 await page.goto("/connect#chatgpt");await page.getByRole("button",{name:"Continue with ChatGPT",exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:"evidence/codex-device-mobile.png",fullPage:true});
 await expect.poll(()=>started,{timeout:10000}).toBe(true);
 await page.getByRole("button",{name:"Cancel sign-in",exact:true}).click();release();
 await expect(page.getByText("Sign-in cancelled.",{exact:true})).toBeVisible();await expect(page.getByText(/late@example.com/)).toHaveCount(0);
 await expect(page.getByLabel("One-time sign-in code")).toHaveCount(0);
});
test("expired device code offers a new attempt without a stale code",async({page})=>{
 await setup(page);await page.route("**/api/connections/codex",r=>r.fulfill({json:{connected:false,phase:"expired"}}));
 await page.goto("/connect#chatgpt");await expect(page.getByText("That code expired. Start a new sign-in.")).toBeVisible();await expect(page.getByRole("button",{name:"Continue with ChatGPT",exact:true})).toBeEnabled();await expect(page.getByLabel("One-time sign-in code")).toHaveCount(0);
});
