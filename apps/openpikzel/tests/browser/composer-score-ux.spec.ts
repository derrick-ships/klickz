import {test,expect} from "@playwright/test";
import {reviewFixture} from "./helpers/review-fixture";
for(const width of [1440,390])test(`unscored image prioritizes scoring at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});await reviewFixture(page,{scored:false,jev:true});
 const action=page.getByRole("button",{name:"Score thumbnail",exact:true});await expect(action).toHaveClass(/primary-button/);const box=(await action.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 await expect(page.getByRole("button",{name:"Download image",exact:true})).toHaveClass(/neutral-button/);
 await page.screenshot({path:`evidence/score-first-local-${width}.png`});
 // Local fixtures cannot dispatch paid calls; the click still enters the score path, never Download.
 await action.click();await expect(page.locator(".error-banner")).toBeVisible();
});
test("YouTube import displays the public title without asking for it again",async({page})=>{
 await page.goto("/studio?mode=analyze");await page.route("**/api/reference",async r=>r.fulfill({path:"public/brand/signal.webp",contentType:"image/webp",headers:{"X-Video-Title":encodeURIComponent("La receta de arepas")}}));
 await page.getByRole("button",{name:"Link",exact:true}).click();await page.getByPlaceholder("Paste a YouTube video or image link").fill("https://youtu.be/abcdefghijk");await page.getByRole("button",{name:"Get thumbnail",exact:true}).click();
 await expect(page.locator(".imported-video-title")).toContainText("Title: La receta de arepas");await expect(page.getByLabel("Video title",{exact:true})).toHaveCount(0);await expect(page.getByLabel("YouTube video link (optional)",{exact:true})).toHaveCount(0);
 await page.locator(".imported-video-title").getByRole("button",{name:"Edit",exact:true}).click();await expect(page.getByLabel("Video title",{exact:true})).toHaveValue("La receta de arepas");
});
