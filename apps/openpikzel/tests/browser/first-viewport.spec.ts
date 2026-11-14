import {test,expect,type Page,type Locator} from "@playwright/test";
import { openMoreOptions } from "./helpers/more-options";
// OP-3: the prompt and the Generate action share the first viewport, with the cost on the button.
const user="11111111-1111-4111-8111-111111111111";
const session={access_token:"header."+Buffer.from(JSON.stringify({sub:user,exp:4102444800})).toString("base64url")+".signature",refresh_token:"fixture-only-refresh",expires_at:4102444800,expires_in:3600,token_type:"bearer",user:{id:user,aud:"authenticated",role:"authenticated",email:"a@example.test",app_metadata:{provider:"email"},user_metadata:{},created_at:"2026-11-08T00:00:00Z"}};
const base={cloud:true,ai:true,jev:false,google:false,ownerGate:false,supabaseUrl:"https://test.supabase.co",supabaseKey:"sb_publishable_test"};
async function setup(page:Page,{signedIn,openai,google=false}:{signedIn:boolean;openai:boolean;google?:boolean}){
 let paid=0;const chats:any[]=[];
 await page.route("**/api/config",r=>r.fulfill({json:{...base,openai,google}}));
 await page.route("**/api/generate",r=>{paid++;return r.abort();});
 await page.route("**/api/jobs",r=>r.fulfill({json:{jobs:[]}}));
 if(signedIn){
  await page.addInitScript(s=>localStorage.setItem("sb-test-auth-token",JSON.stringify(s)),session);
  await page.route("https://test.supabase.co/**",r=>{const req=r.request(),headers={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"GET,POST,PATCH,DELETE,OPTIONS"};if(req.method()==="OPTIONS")return r.fulfill({status:204,headers});if(new URL(req.url()).pathname.includes("/auth/"))return r.fulfill({json:session.user,headers});if(req.method()==="POST"){const row=req.postDataJSON();const list=Array.isArray(row)?row:[row];for(const item of list){const i=chats.findIndex(c=>c.id===item.id);if(i<0)chats.push(item);else chats[i]={...chats[i],...item};}return r.fulfill({status:201,body:"",headers});}
   const url=new URL(req.url()),rows=url.pathname.endsWith("studio_conversations")?chats.filter(c=>!url.searchParams.has("id")||url.searchParams.get("id")==="eq."+c.id):[];
   return r.fulfill({json:req.headers().accept?.includes("vnd.pgrst.object")?rows[0]||null:rows,headers});});
 }else await page.route("https://test.supabase.co/**",r=>r.abort());
 return {paid:()=>paid};
}
async function inView(locator:Locator,page:Page){const box=(await locator.boundingBox())!,view=page.viewportSize()!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(view.height);expect(box.x+box.width).toBeLessThanOrEqual(view.width);}
const sizes=[{width:1440,height:900},{width:390,height:844}];
for(const size of sizes){
 test("signed out at "+size.width+"x"+size.height+": prompt, action, cost and key note fit without scrolling",async({page})=>{
  await page.setViewportSize(size);await setup(page,{signedIn:false,openai:false});await page.goto("/studio?mode=generate");
  const prompt=page.getByLabel("Describe your thumbnail",{exact:true}),action=page.getByRole("button",{name:"Sign in to generate",exact:true});
  await expect(action).toBeEnabled();expect(await page.evaluate(()=>scrollY)).toBe(0);
  await inView(prompt,page);await inView(action,page);
  const cost=page.locator(".generate-cost");await expect(cost).toHaveText("~$0.03 + score");await expect(cost).toHaveAttribute("aria-hidden","true");await inView(cost,page);
  const note=page.locator("#generate-key-note");await expect(note).toHaveText("Uses your own API key. Connect once in Connections.");await inView(note,page);
  await expect(page.getByRole("region",{name:"Before you start"})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
 });
 test("signed in with a key at "+size.width+"x"+size.height+": the action keeps its exact name and announces the cost",async({page})=>{
  await page.setViewportSize(size);const f=await setup(page,{signedIn:true,openai:true});await page.goto("/studio?mode=generate");
  const action=page.getByRole("button",{name:"Create thumbnail",exact:true});await expect(action).toBeEnabled();
  await inView(page.getByLabel("Describe your thumbnail",{exact:true}),page);await inView(action,page);
  await expect(action).toHaveAccessibleDescription(/Estimated image output about \$0\.03 for 1 image, plus a score\. Inputs and any analysis are extra\./);
  await expect(action.locator(".generate-cost")).toHaveText("~$0.03 + score");
  // Validation error: no paid request, the message is announced and the action stays in reach.
  await action.click();await expect(page.locator("#prompt-error")).toContainText("eight characters");expect(f.paid()).toBe(0);
  await page.evaluate(()=>scrollTo(0,0));await inView(action,page);
  // Long text scrolls inside the field instead of pushing the action out of view.
  const prompt=page.getByLabel("Describe your thumbnail",{exact:true});await prompt.fill("A tired developer at 3am, red error logs, a coffee tower, the words \"IT WORKED?!\" ".repeat(28));
  await page.evaluate(()=>scrollTo(0,0));await inView(action,page);
 });
}
test("no key: the one-line note opens Connections and full readiness details stay available",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await setup(page,{signedIn:true,openai:false});await page.goto("/studio?mode=generate");
 const action=page.getByRole("button",{name:"Connect OpenAI",exact:true});await expect(action).toBeVisible();await inView(action,page);
 const note=page.locator("#generate-key-note");const box=(await note.boundingBox())!;expect(box.height).toBeLessThan(30);
 await note.getByRole("button",{name:"Connect once in Connections.",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Manage connections");await page.keyboard.press("Escape");
 const info=page.locator("#request-readiness");await expect(info).toContainText("OpenAI · Flare 2.6");await expect(info).toContainText("1 image · 16:9");await expect(info).toContainText("Estimated image output");await expect(info).toContainText("ChatGPT and Claude subscriptions alone do not enable studio generation");
});
test("loading keeps a neutral disabled action with no cost claim",async({page})=>{
 let release!:()=>void;const hold=new Promise<void>(r=>release=r);await page.route("**/api/config",async r=>{await hold;await r.fulfill({json:{...base,openai:false}});});await page.route("https://test.supabase.co/**",r=>r.abort());
 await page.setViewportSize({width:390,height:844});await page.goto("/studio?mode=generate");
 const action=page.getByRole("button",{name:"Checking your workspace…",exact:true});await expect(action).toBeDisabled();await inView(action,page);await expect(action.locator(".generate-cost")).toHaveCount(0);
 release();await expect(page.getByRole("button",{name:"Sign in to generate",exact:true})).toBeEnabled();
});
test("reduced motion and mode switches keep the action beside the prompt",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:390,height:844});await setup(page,{signedIn:false,openai:false});await page.goto("/studio?mode=generate");
 for(const mode of ["Remix","Edit","Titles","Create"]){await page.getByRole("tab",{name:mode,exact:true}).click();const prompt=page.locator("#thumbnail-prompt"),action=page.locator(".generate-split > .primary-button");const p=(await prompt.boundingBox())!,a=(await action.boundingBox())!;expect(a.y).toBeGreaterThan(p.y+p.height-1);expect(a.y-(p.y+p.height)).toBeLessThan(80);}
});
// Critiquito FIX: prompt validation sits under the field, never as a top banner.
const allSizes=[{width:1440,height:900},{width:390,height:844},{width:320,height:640}];
for(const size of allSizes){
 test("validation at "+size.width+"x"+size.height+": message under the field, field invalid and focused, no top banner",async({page})=>{
  await page.setViewportSize(size);const f=await setup(page,{signedIn:true,openai:true});await page.goto("/studio?mode=generate");
  const prompt=page.locator("#thumbnail-prompt"),action=page.getByRole("button",{name:"Create thumbnail",exact:true});await expect(action).toBeEnabled();
  await expect(prompt).not.toHaveAttribute("aria-invalid","true");
  await action.click();
  const message=page.locator("#prompt-error");await expect(message).toHaveRole("alert");await expect(message).toHaveText("Describe your thumbnail in at least eight characters.");
  await expect(page.locator(".error-banner")).toHaveCount(0);expect(f.paid()).toBe(0);
  await expect(prompt).toHaveAttribute("aria-invalid","true");await expect(prompt).toBeFocused();
  expect((await prompt.getAttribute("aria-describedby"))?.split(" ")).toContain("prompt-error");
  await expect(prompt).toHaveAccessibleDescription(/at least eight characters/);
  await expect(prompt).toHaveCSS("box-shadow",/rgb\(255, 146, 151\)/);
  const p=(await prompt.boundingBox())!,m=(await message.boundingBox())!,a=(await action.boundingBox())!;
  expect(m.y).toBeGreaterThanOrEqual(p.y+p.height-1);expect(m.y+m.height).toBeLessThanOrEqual(a.y+1);expect(m.y-(p.y+p.height)).toBeLessThan(24);
  // A short edit keeps the message; a valid prompt clears it without another submit.
  await prompt.fill("short");await expect(message).toBeVisible();await expect(prompt).toHaveAttribute("aria-invalid","true");
  await prompt.fill("A cat on a skateboard, bold yellow title");await expect(message).toHaveCount(0);
  await expect(prompt).not.toHaveAttribute("aria-invalid","true");expect((await prompt.getAttribute("aria-describedby"))||"").not.toContain("prompt-error");
 });
 test("split button parts never touch at "+size.width+"x"+size.height,async({page})=>{
  await page.setViewportSize(size);await setup(page,{signedIn:false,openai:false});await page.goto("/studio?mode=generate");
  for(const mode of ["Create","Remix","Edit","Titles"]){
   await page.getByRole("tab",{name:mode,exact:true}).click();
   const button=page.locator(".generate-split > .primary-button");await expect(button.locator(".generate-cost")).toBeVisible();
   const r=await page.evaluate(()=>{const q=(s:string)=>document.querySelector(s)!.getBoundingClientRect();const b=q(".generate-split > .primary-button"),l=q(".generate-split > .primary-button > span:not(.generate-cost)"),c=q(".generate-cost"),s=q(".generate-split .batch-select");return {b:{l:b.left,r:b.right,t:b.top,bo:b.bottom},l:{l:l.left,r:l.right,t:l.top,bo:l.bottom},c:{l:c.left,r:c.right,t:c.top,bo:c.bottom},s:{l:s.left,r:s.right}};});
   const apart=(x:{l:number;r:number;t:number;bo:number},y:{l:number;r:number;t:number;bo:number})=>x.r+4<=y.l||y.r+4<=x.l||x.bo+1<=y.t||y.bo+1<=x.t;
   expect(apart(r.l,r.c),mode+": label and cost").toBe(true);
   expect(r.c.r,mode+": cost inside the button").toBeLessThanOrEqual(r.b.r);expect(r.l.r,mode+": label inside the button").toBeLessThanOrEqual(r.b.r);
   expect(r.b.r,mode+": button before the selector").toBeLessThanOrEqual(r.s.l+1);
   await expect(button).toHaveAccessibleName("Sign in to generate");
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
 });
}
test("non-validation errors keep the top banner",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await setup(page,{signedIn:true,openai:true});await page.goto("/studio?mode=recreate");
 await page.locator("#thumbnail-prompt").fill("Swap the desk for a kitchen, keep the layout");
 await page.getByRole("button",{name:"Create variation",exact:true}).click();
 await expect(page.locator(".error-banner")).toContainText("Add a thumbnail reference to recreate.");
 await expect(page.locator("#prompt-error")).toHaveCount(0);await expect(page.locator("#thumbnail-prompt")).not.toHaveAttribute("aria-invalid","true");
});

// Critiquito round 2: the key note reflects the real connection state and is not repeated by the provider helper.
for(const size of allSizes){
 test("key note at "+size.width+"x"+size.height+" says which key is in use once it is connected",async({page})=>{
  await page.setViewportSize(size);await setup(page,{signedIn:true,openai:true});await page.goto("/studio?mode=generate");
  await expect(page.getByRole("button",{name:"Create thumbnail",exact:true})).toBeEnabled();
  const note=page.locator("#generate-key-note");await expect(note).toHaveText("Using your OpenAI key.");await expect(note.getByRole("button")).toHaveCount(0);
  const helper=page.locator(".composer .provider-choice p");await expect(helper).not.toContainText("key connected");await expect(helper).toContainText("Model access and balance are checked when you run.");
  await expect(page.getByText("OpenAI key connected",{exact:false})).toHaveCount(0);
 });
}
test("no key and signed out keep the connect line with its link",async({page})=>{
 await setup(page,{signedIn:true,openai:false});await page.goto("/studio?mode=generate");
 await expect(page.getByRole("button",{name:"Connect OpenAI",exact:true})).toBeVisible();
 await expect(page.locator("#generate-key-note")).toHaveText("Uses your own API key. Connect once in Connections.");
 await expect(page.locator("#generate-key-note").getByRole("button",{name:"Connect once in Connections.",exact:true})).toBeVisible();
 await expect(page.locator(".composer .provider-choice p")).toContainText("Connect your own OpenAI API key in Connections");
});
test("a different text provider keeps its own connected status, because it is a different fact",async({page})=>{
 await setup(page,{signedIn:true,openai:true,google:true});await page.goto("/studio?mode=generate");
 await expect(page.locator("#generate-key-note")).toHaveText("Using your OpenAI key.");
 await openMoreOptions(page);await page.getByRole("combobox",{name:"Text and review provider",exact:true}).selectOption("google");
 await expect(page.locator(".composer .provider-choice p")).toContainText("Google key connected.");
 await expect(page.locator("#generate-key-note")).toHaveText("Using your OpenAI key.");
});
