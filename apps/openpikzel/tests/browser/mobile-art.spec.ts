import { test, expect } from "@playwright/test";
const widths = [320, 375, 390, 414, 430];
test("mobile welcome art renders and stays still", async ({page}) => {
  test.setTimeout(60000);
  for(const width of widths) {
    await page.setViewportSize({width,height:932});
    await page.goto("/welcome");
    const scene=page.locator('[data-brand-scene="aperture"]');
    await scene.locator("img").evaluate(i=>(i as HTMLImageElement).decode());
    await expect(scene).toHaveAttribute("data-motion","still");
    await expect(scene.locator("source")).toHaveCount(0);
    const before=await scene.boundingBox();
    await page.screenshot({path:`evidence/mobile-art-default-${width}.png`,fullPage:true});
    if(width===430) {
      await expect(scene).toHaveAttribute("data-motion","still",{timeout:6000});
      expect(await scene.boundingBox()).toEqual(before);
      await page.screenshot({path:"evidence/mobile-art-settled-430.png",fullPage:true});
    }
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const [width,height] of [[1280,800],[1440,1000]]) {
    await page.setViewportSize({width,height});
    await page.goto("/welcome");
    await page.screenshot({path:`evidence/mobile-art-desktop-${width}.png`,fullPage:true});
  }
});
