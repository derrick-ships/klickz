import {test,expect} from "@playwright/test";
import {reviewFixture} from "./helpers/review-fixture";
test.beforeEach(async({page})=>{
 await page.route("**/*",r=>(new URL(r.request().url()).hostname==="127.0.0.1"||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
});
test("first-session typing survives immediate reload and does not create duplicate chats",async({page})=>{
 await page.goto("/studio");const prompt=page.getByLabel("Prompt",{exact:true});
 await prompt.fill("My first idea must survive an immediate page refresh");
 await page.reload();await expect(prompt).toHaveValue("My first idea must survive an immediate page refresh");
 await expect(page.locator(".chat-save-state")).toHaveText("Saved on this device");
 await expect(page.getByRole("button",{name:/^Open chat:/})).toHaveCount(1);
 await prompt.fill("A second revision of this same first idea");
 await page.getByRole("button",{name:"Save draft",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Concept saved.",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:/^Open chat:/})).toHaveCount(1);
 await page.reload();await expect(prompt).toHaveValue("A second revision of this same first idea");
});
test("saved edit retains its original image and draft through reload",async({page})=>{
 await reviewFixture(page,false);
 await page.getByRole("region",{name:"Thumbnail review studio"}).getByRole("button",{name:"Edit",exact:true}).click();
 await page.getByLabel("Edits",{exact:true}).fill("Simplify the background and preserve the red subject");
 const preview=page.getByRole("img",{name:/Editing source:/});await expect(preview).toBeVisible();
 await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page.getByRole("heading",{name:"Concept saved.",exact:true})).toBeVisible();
 await expect(preview).toBeVisible();await page.reload();await expect(preview).toBeVisible();
 await expect(page.getByLabel("Edits",{exact:true})).toHaveValue("Simplify the background and preserve the red subject");
 await expect(page.locator(".source-input .upload-target")).toBeHidden();
 for(const width of [1440,1100,390,320]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});
  await expect(preview).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const controls=page.getByRole("button",{name:"Controls",exact:true});expect(parseFloat(await controls.evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
  await page.screenshot({path:"evidence/panel-after-edit-"+width+".png",fullPage:true});
 }
});
test("setup is actionable without a paid call and preserves the draft",async({page})=>{
 const paid:string[]=[];page.on("request",r=>{if(/\/api\/(generate|analyze|titles)$/.test(r.url()))paid.push(r.url());});
 await page.goto("/studio");await page.getByLabel("Prompt",{exact:true}).fill("Keep this idea while I connect my account");
 await page.getByRole("button",{name:"Sign in to generate",exact:true}).click();
 await expect(page.getByRole("dialog").getByLabel("Email",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Close dialog",exact:true}).click();
 await expect(page.getByLabel("Prompt",{exact:true})).toHaveValue("Keep this idea while I connect my account");expect(paid).toEqual([]);
});
test("review protects image size at intermediate width and keeps reduced motion static",async({page})=>{
 await reviewFixture(page);await page.setViewportSize({width:1100,height:900});await page.emulateMedia({reducedMotion:"reduce"});
 const media=await page.locator(".review-media").boundingBox(),inspector=await page.locator(".review-inspector").boundingBox();
 expect(media!.width).toBeGreaterThan(600);expect(inspector!.y).toBeGreaterThan(media!.y);
 await expect(page.locator(".result-image img")).toHaveCSS("animation-name","none");
 await page.screenshot({path:"evidence/panel-after-review-1100.png",fullPage:true});
});

test("navigation before first autosave preserves the detached draft",async({page})=>{
 await page.goto("/studio");await page.getByLabel("Prompt",{exact:true}).fill("Save this first idea even when I immediately start a new chat");
 await page.getByRole("button",{name:"New chat",exact:true}).click();await expect(page.getByLabel("Prompt",{exact:true})).toHaveValue("");
 await page.getByRole("button",{name:/^Open chat: Save this first idea/}).click();await expect(page.getByLabel("Prompt",{exact:true})).toHaveValue("Save this first idea even when I immediately start a new chat");
});
