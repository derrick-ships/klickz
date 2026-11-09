import {test,expect} from "@playwright/test";
import {reviewFixture} from "./helpers/review-fixture";
test("composer is the sole settings home with provider-aware identity and honest readiness",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto("/studio?mode=generate");
 await expect(page.getByRole("button",{name:"Connections",exact:true})).toHaveCount(1);
 await expect(page.locator("aside.sidebar select,aside.sidebar .model-trigger")).toHaveCount(0);await expect(page.getByRole("button",{name:"Workspace settings",exact:true})).toHaveCount(0);
 const model=page.getByRole("button",{name:"Rendering model",exact:true});await expect(model).toHaveText("Flare 2.6");
 const info=page.locator("#request-readiness");await expect(info).toContainText("OpenAI · Flare 2.6 · gpt-image-2.6-flare");await expect(info).toContainText("Sign in and connect");await expect(info).toContainText("Cost cannot be estimated reliably");
 await model.click();await page.getByRole("button",{name:"Gemini Pro",exact:true}).click();await expect(info).toContainText("Google · Gemini Pro · gemini-3-pro-image");
 await page.getByLabel("Batch size",{exact:true}).selectOption("4");await page.getByLabel("Format",{exact:true}).selectOption("short");await expect(info).toContainText("4 images · 9:16");
 const prompt=page.getByLabel("Prompt",{exact:true});await prompt.fill("Keep this unsent direction");await page.getByRole("tab",{name:"Title",exact:true}).click();await page.getByRole("tab",{name:"Prompt",exact:true}).click();await expect(prompt).toHaveValue("Keep this unsent direction");
 await expect(prompt).toHaveCSS("font-size","16px");await page.screenshot({path:"evidence/audit-readiness-1440.png",fullPage:true});
});
test("editing keeps the selected image next to unsent instructions at desktop and narrow widths",async({page})=>{
 const paid:string[]=[];page.on("request",r=>{if(/\/api\/(generate|analyze)$/.test(r.url()))paid.push(r.url());});
 await page.setViewportSize({width:1440,height:900});await reviewFixture(page,false);
 await page.getByRole("tab",{name:"Prompt",exact:true}).click();await page.getByLabel("Prompt",{exact:true}).fill("Keep my unsent edit instructions");
 const stage=page.getByRole("region",{name:"Thumbnail review studio"});
 await stage.getByRole("button",{name:"Edit",exact:true}).click();
 const edits=page.getByLabel("Edits",{exact:true}),image=page.getByRole("img",{name:/Editing source:/});
 await expect(edits).toHaveValue("Keep my unsent edit instructions");await expect(edits).toBeFocused();await expect(image).toBeInViewport();
 const original=await stage.locator(".result-image img").getAttribute("src");await expect(image).toHaveAttribute("src",original!);
 const a=await image.boundingBox(),b=await edits.boundingBox();expect(a!.width).toBeGreaterThanOrEqual(280);expect(a!.x+a!.width).toBeLessThan(b!.x);expect(Math.abs(a!.y-b!.y)).toBeLessThan(65);
 await page.screenshot({path:"evidence/audit-edit-1440.png"});
 await page.getByRole("button",{name:"Controls",exact:true}).click();await expect(image).toBeVisible();await expect(edits).toHaveValue("Keep my unsent edit instructions");
 for(const width of [390,320]){await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});await edits.scrollIntoViewIfNeeded();await expect(image).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:"evidence/audit-edit-"+width+".png"});
  await page.locator(".edit-source-preview summary").click();await expect(image).toBeHidden();await expect(edits).toHaveValue("Keep my unsent edit instructions");await page.locator(".edit-source-preview summary").click();await expect(image).toBeVisible();
 }
 await page.waitForTimeout(900);await page.reload();await page.getByRole("tab",{name:"Edit",exact:true}).click();await expect(edits).toHaveValue("Keep my unsent edit instructions");await expect(image).toBeVisible();expect(paid).toEqual([]);
});
