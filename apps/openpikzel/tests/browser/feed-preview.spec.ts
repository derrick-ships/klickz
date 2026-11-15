import {test,expect} from "@playwright/test";
import {reviewFixture} from "./helpers/review-fixture";
test("Browse and Suggested simulate YouTube placements and grayscale is preview-only",async({page})=>{
 await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 await reviewFixture(page,false);
 await page.getByRole("button",{name:"Toggle phone feed preview",exact:true}).click();
 const preview=page.locator(".youtube-preview"),image=preview.locator("img");
 const original=await image.getAttribute("src");
 await expect(preview).toHaveAttribute("data-placement","browse");
 await expect(page.getByRole("button",{name:"Browse",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("button",{name:"Black & white",exact:true}).click();
 await expect(preview).toHaveAttribute("data-monochrome","true");
 await expect(preview).toContainText("not live YouTube data");
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  for(const placement of ["Browse","Suggested"]){
   await page.getByRole("button",{name:placement,exact:true}).click();
   await expect(preview).toHaveAttribute("data-placement",placement.toLowerCase());
   await expect(page.getByRole("button",{name:placement,exact:true})).toHaveAttribute("aria-pressed","true");
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   await expect.poll(()=>preview.locator(".youtube-preview-thumbnail").evaluate(el=>getComputedStyle(el).filter)).toBe("grayscale(1)");
   await preview.scrollIntoViewIfNeeded();await page.screenshot({path:"evidence/feed-"+placement.toLowerCase()+"-"+width+".png"});
  }
 }
 expect(await image.getAttribute("src")).toBe(original);
 await page.getByRole("button",{name:"Toggle phone feed preview",exact:true}).click();
 expect(await page.locator(".review-canvas img").evaluate(el=>getComputedStyle(el).filter)).toBe("none");
});
