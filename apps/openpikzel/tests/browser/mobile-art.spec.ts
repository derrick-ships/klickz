import { test, expect } from "@playwright/test";
import sharp from "sharp";
const widths = [320, 375, 390, 414, 430];
async function redBounds(bytes: Buffer) {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let top=info.height, bottom=0, left=info.width, right=0, count=0;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
    const i=(y*info.width+x)*info.channels;
    if(data[i]>140 && data[i]>data[i+1]*1.7 && data[i]>data[i+2]*1.5) {
      top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);count++;
    }
  }
  return { top, bottom: info.height-1-bottom, left, right: info.width-1-right, count };
}
test("mobile art preserves the red subject at all representative widths", async ({page}, testInfo) => {
  await page.emulateMedia({ reducedMotion:"reduce" });
  for(const width of widths) {
    await page.setViewportSize({width,height:932});
    await page.goto("/welcome");
    const scene=page.locator('[data-brand-scene="aperture"]');
    await scene.locator("img").evaluate(i => (i as HTMLImageElement).decode());
    const crop=await scene.screenshot();
    const bounds=await redBounds(crop);
    await page.screenshot({path:`evidence/mobile-art-still-${width}.png`,fullPage:true});
    console.log(JSON.stringify({width,redMargins:bounds}));
    await testInfo.attach(`art-${width}`,{body:crop,contentType:"image/png"});
    expect(bounds.count).toBeGreaterThan(200);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(scene.locator("source")).toHaveCount(0);
  }
});

test("mobile default still preserves the corrected crop without layout shifts", async ({page}) => {
  test.setTimeout(60000);
  for(const width of widths) {
    await page.setViewportSize({width,height:932});
    await page.goto("/welcome");
    const scene=page.locator('[data-brand-scene="aperture"]');
    await scene.locator("img").evaluate(i=>(i as HTMLImageElement).decode());
    await expect(scene).toHaveAttribute("data-motion","still");
    await expect(scene.locator("source")).toHaveCount(0);
    const before=await scene.boundingBox();
    const bounds=await redBounds(await scene.screenshot());
    expect(bounds.count).toBeGreaterThan(200);
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
