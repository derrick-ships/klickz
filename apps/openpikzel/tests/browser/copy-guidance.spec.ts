import {test,expect} from "@playwright/test";
import {reviewFixture} from "./helpers/review-fixture";
test.beforeEach(async({page})=>{
 await page.route("**/*",r=>(new URL(r.request().url()).hostname==="127.0.0.1"||/^(blob|data):/.test(r.request().url()))?r.continue():r.abort());
});
test("analysis setup preserves a real title and video link across modes and reload",async({page})=>{
 await reviewFixture(page,false);
 await page.getByRole("button",{name:"Set up analysis",exact:true}).click();
 const title=page.getByLabel("Video title",{exact:true}),brief=page.getByLabel("YouTube video link (optional)",{exact:true});
 await expect(title).toBeFocused();
 await title.fill("My actual video title, not the image brief");await brief.fill("https://www.youtube.com/watch?v=abcdefghijk");
 await page.getByRole("tab",{name:"Prompt",exact:true}).click();await page.getByRole("button",{name:"Set up analysis",exact:true}).click();
 await expect(title).toHaveValue("My actual video title, not the image brief");
 await expect(brief).toHaveValue("https://www.youtube.com/watch?v=abcdefghijk");
 await expect(page.locator(".diagnostic-context")).toContainText("No written summary is required.");
 await page.reload();await page.getByRole("button",{name:"Set up analysis",exact:true}).click();
 await expect(title).toHaveValue("My actual video title, not the image brief");
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});
  await title.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:"evidence/copy-analysis-"+width+".png",fullPage:true});
 }
});
test("prompt guidance and expanded settings fit desktop and narrow screens without losing a draft",async({page})=>{
 await page.goto("/studio");const prompt=page.getByLabel("Describe your thumbnail",{exact:true});
 await prompt.fill('A red studio desk with the words "SEVEN DAYS"');
 await page.getByRole("button",{name:"Generation settings",exact:true}).click();
 await expect(page.getByLabel("Planning effort",{exact:true})).toHaveValue("medium");
 await page.getByLabel("Planning effort",{exact:true}).selectOption("high");
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:"reduce"});
  await prompt.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:"evidence/copy-settings-"+width+".png",fullPage:true});
 }
 await page.reload();await expect(prompt).toHaveValue('A red studio desk with the words "SEVEN DAYS"');
 await page.getByRole("button",{name:"Generation settings",exact:true}).click();await expect(page.getByLabel("Planning effort",{exact:true})).toHaveValue("high");
});

test("clearing a filtered library recovers existing drafts without creating a chat",async({page})=>{
 await page.goto("/studio");await page.getByLabel("Describe your thumbnail",{exact:true}).fill("My saved idea should remain after filtering");
 await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page.getByRole("heading",{name:"Concept saved.",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"My creations",exact:true}).click();await page.getByLabel("Search creations",{exact:true}).fill("no matching results");await page.getByRole("button",{name:"Favorites",exact:true}).click();
 await expect(page.getByRole("heading",{name:"No creations match these filters.",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Clear filters",exact:true}).click();await expect(page.getByLabel("Search creations",{exact:true})).toHaveValue("");await expect(page.getByRole("button",{name:"Favorites",exact:true})).toHaveAttribute("aria-pressed","false");
 await expect(page.locator(".creation-grid article")).toHaveCount(1);await expect(page.getByRole("button",{name:/^Open chat:/})).toHaveCount(1);
});
