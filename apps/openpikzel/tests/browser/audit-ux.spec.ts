import {test,expect} from "@playwright/test";
import { openMoreOptions, openResultMore } from "./helpers/more-options";
import {reviewFixture} from "./helpers/review-fixture";
test("composer is the sole settings home with provider-aware identity and honest readiness",async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto("/studio?mode=generate");
 await expect(page.getByRole("button",{name:"Connections",exact:true})).toHaveCount(1);
 await expect(page.locator("aside.sidebar select,aside.sidebar .model-trigger")).toHaveCount(0);await expect(page.getByRole("button",{name:"Workspace settings",exact:true})).toHaveCount(0);
 await openMoreOptions(page);const model=page.getByRole("button",{name:/^Rendering model:/});await expect(model).toHaveText("Flare 2.6");
 // The cost disclosure was removed (16 Nov); the model trigger and the action carry the choice.
 await expect(page.locator("#request-readiness")).toHaveCount(0);await expect(page.getByRole("button",{name:"Sign in to generate",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Sign in to generate",exact:true})).not.toContainText("$");
 await model.click();await page.getByRole("button",{name:"Gemini Pro",exact:true}).click();await expect(page.getByRole("button",{name:/^Rendering model:/})).toHaveText("Gemini Pro");
 await page.getByLabel("Images per request",{exact:true}).selectOption("4");await page.getByLabel("Format",{exact:true}).selectOption("short");await expect(page.getByLabel("Images per request",{exact:true})).toHaveValue("4");
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);if(width===320)expect((await page.locator(".format-chip").boundingBox())!.width).toBeGreaterThan(140);}
 const prompt=page.getByLabel("Describe your thumbnail",{exact:true});await prompt.fill("Keep this unsent direction");await page.getByRole("tab",{name:"Score",exact:true}).click();await page.getByRole("tab",{name:"Create",exact:true}).click();await expect(prompt).toHaveValue("Keep this unsent direction");
 await expect(prompt).toHaveCSS("font-size","16px");await page.screenshot({path:"evidence/audit-readiness-1440.png",fullPage:true});
});
