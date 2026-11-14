import {test,expect} from "@playwright/test";
import { openMoreOptions } from "./helpers/more-options";
import {reviewFixture} from "./helpers/review-fixture";
test("composer is the sole settings home with provider-aware identity and honest readiness",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto("/studio?mode=generate");
 await expect(page.getByRole("button",{name:"Connections",exact:true})).toHaveCount(1);
 await expect(page.locator("aside.sidebar select,aside.sidebar .model-trigger")).toHaveCount(0);await expect(page.getByRole("button",{name:"Workspace settings",exact:true})).toHaveCount(0);
 await openMoreOptions(page);const model=page.getByRole("button",{name:/^Rendering model:/});await expect(model).toHaveText("Flare 2.6");
 const info=page.locator("#request-readiness");await expect(info).toContainText("OpenAI · Flare 2.6");await expect(info.locator("details")).toContainText("API model: gpt-image-2.6-flare");await expect(page.getByRole("button",{name:"Sign in to generate",exact:true})).toBeVisible();await expect(info).toContainText("the total remains unknown");
 await model.click();await page.getByRole("button",{name:"Gemini Pro",exact:true}).click();await expect(info).toContainText("Google · Gemini Pro");await expect(info.locator("details")).toContainText("API model: gemini-3-pro-image");
 await page.getByLabel("Images per request",{exact:true}).selectOption("4");await page.getByLabel("Format",{exact:true}).selectOption("short");await expect(info).toContainText("4 images · 9:16");
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);if(width===320)expect((await page.locator(".format-chip").boundingBox())!.width).toBeGreaterThan(140);}
 const prompt=page.getByLabel("Describe your thumbnail",{exact:true});await prompt.fill("Keep this unsent direction");await page.getByRole("tab",{name:"Titles",exact:true}).click();await page.getByRole("tab",{name:"Create",exact:true}).click();await expect(prompt).toHaveValue("Keep this unsent direction");
 await expect(prompt).toHaveCSS("font-size","16px");await page.screenshot({path:"evidence/audit-readiness-1440.png",fullPage:true});
});
test("editing keeps the selected image next to unsent instructions at desktop and narrow widths",async({page})=>{
 const paid:string[]=[];page.on("request",r=>{if(/\/api\/(generate|analyze)$/.test(r.url()))paid.push(r.url());});
 await page.setViewportSize({width:1440,height:900});await reviewFixture(page,false);
 await page.getByRole("tab",{name:"Create",exact:true}).click();await page.getByLabel("Describe your thumbnail",{exact:true}).fill("Keep my unsent edit instructions");
 const stage=page.getByRole("region",{name:"Thumbnail review studio"});
 await stage.getByRole("button",{name:"Edit",exact:true}).click();
 const edits=page.getByLabel("What should change?",{exact:true}),image=page.getByRole("img",{name:/Editing source:/});
 await expect(edits).toHaveValue("Keep my unsent edit instructions");await expect(edits).toBeFocused();await expect(image).toBeInViewport();
 const original=await stage.locator(".result-image img").getAttribute("src");await expect(image).toHaveAttribute("src",original!);
 const a=await image.boundingBox(),b=await edits.boundingBox();expect(a!.width).toBeGreaterThanOrEqual(280);expect(a!.x+a!.width).toBeLessThan(b!.x);expect(Math.abs(a!.y-b!.y)).toBeLessThan(65);
 await page.screenshot({path:"evidence/audit-edit-1440.png"});
 await page.locator('details.more-options:not(.request-readiness):not([open]) > summary').first().click().catch(()=>{});await expect(image).toBeVisible();await expect(edits).toHaveValue("Keep my unsent edit instructions");
 for(const width of [390,320]){await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});await edits.scrollIntoViewIfNeeded();await expect(image).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:"evidence/audit-edit-"+width+".png"});
  await page.locator(".edit-source-preview summary").click();await expect(image).toBeHidden();await expect(edits).toHaveValue("Keep my unsent edit instructions");await page.locator(".edit-source-preview summary").click();await expect(image).toBeVisible();
 }
 await page.waitForTimeout(900);await page.reload();await page.getByRole("tab",{name:"Edit",exact:true}).click();await expect(edits).toHaveValue("Keep my unsent edit instructions");await expect(image).toBeVisible();expect(paid).toEqual([]);
});
