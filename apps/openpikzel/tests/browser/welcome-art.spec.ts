import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

const sizes = [[320,844],[375,812],[390,844],[414,896],[430,932],[1280,800],[1440,900]];
const luminance = (r: number, g: number, b: number) => [r,g,b].map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum,v,i) => sum + v * [0.2126,0.7152,0.0722][i], 0);

async function pixels(bytes: Buffer) {
  return sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

test("welcome artwork preserves its isolated composition", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  for (const [width,height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto("/welcome");
    await page.locator(".welcome-art img").evaluate((img: HTMLImageElement) => img.decode());
    await page.evaluate(() => document.fonts.ready);
    const hero = page.locator(".welcome-hero");
    const before = (await hero.boundingBox())!;
    const boxes = await page.evaluate(() => {
      const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
      const selectors = [".welcome-hook", ".welcome-headline", ".welcome-subtitle", ".welcome-lead", ".welcome-primary", ".welcome-secondary", ".welcome-cost-inline", ".welcome-outcome", ".welcome-hero-index span"];
      const hero = document.querySelector(".welcome-hero")!;
      const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
      const lines: { x:number; y:number; right:number; bottom:number; color:string; buttonBg:string | null; text:string }[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim()) continue;
        const el = node.parentElement!;
        const style = getComputedStyle(el);
        if (el.closest(".welcome-art") || style.visibility !== "visible" || style.display === "none") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const button = el.closest(".welcome-primary");
        for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) {
          lines.push({ x:r.x, y:r.y, right:r.right, bottom:r.bottom, color:style.color, buttonBg:button ? getComputedStyle(button).backgroundColor : null, text:node.textContent.trim() });
        }
      }
      return { lead:rect(document.querySelector(".welcome-lead")!), index:rect(document.querySelector(".welcome-hero-index")!), texts:selectors.flatMap(s => Array.from(document.querySelectorAll(s), el => rect(el))), lines };
    });
    await page.addStyleTag({ content: ".welcome-hero-copy,.welcome-hero-index{visibility:hidden!important}" });
    expect(await hero.boundingBox()).toEqual(before);
    const clip = { x:before.x, y:before.y, width:before.width, height:before.height };
    const image = await pixels(await page.screenshot({ clip, fullPage: true }));
    const {data,info} = image;
    let count=0, red=0, left=info.width, right=-1, top=info.height, bottom=-1, redLeft=info.width, redRight=-1, redTop=info.height, redBottom=-1, lastMax=0;
    for (let y=0;y<info.height;y++) for (let x=0;x<info.width;x++) {
      const i=(y*info.width+x)*info.channels, r=data[i], g=data[i+1], b=data[i+2];
      if (Math.max(r,g,b)>25) { count++; left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y); }
      if (r>140 && r>1.7*g && r>1.5*b) { red++; redLeft=Math.min(redLeft,x); redRight=Math.max(redRight,x); redTop=Math.min(redTop,y); redBottom=Math.max(redBottom,y); }
      if (y>=info.height-12) lastMax=Math.max(lastMax,r,g,b);
    }
    expect(count, `W1 ${width}`).toBeGreaterThanOrEqual(width<=430 ? 3000 : 50000);
    expect(lastMax, `W3 fade ${width}`).toBeLessThanOrEqual(14);
    expect(bottom, `W3 bottom ${width}`).toBeLessThanOrEqual(info.height-32);
    expect(right, `W4 bleed ${width}`).toBe(width-1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width<=430) {
      expect(top+before.y, `W2 clearance ${width}`).toBeGreaterThanOrEqual(boxes.lead.bottom+24);
      expect(bottom+before.y, `W3 index ${width}`).toBeLessThanOrEqual(boxes.index.y-8);
      for (const box of boxes.texts.slice(0,4)) {
        let max=0;
        for(let y=Math.max(0,Math.floor(box.y-before.y));y<Math.min(info.height,Math.ceil(box.bottom-before.y));y++) for(let x=Math.max(0,Math.floor(box.x-before.x));x<Math.min(info.width,Math.ceil(box.right-before.x));x++) { const i=(y*info.width+x)*info.channels; max=Math.max(max,luminance(data[i],data[i+1],data[i+2])); }
        expect(max, `W2 background ${width}`).toBeLessThanOrEqual(.0035);
      }
    } else {
      expect(red, `W5 red ${width}`).toBeGreaterThanOrEqual(15000);
      expect(redLeft, `W5 copy clearance ${width}`).toBeGreaterThanOrEqual(Math.max(...boxes.texts.slice(0,4).map(b=>b.right))-before.x+200);
      expect(redLeft).toBeGreaterThan(left);
      expect(redTop).toBeGreaterThanOrEqual(160);
      expect(info.height-1-redBottom).toBeGreaterThanOrEqual(120);
      expect(redRight).toBe(width-1);
    }
    expect(boxes.lines.length, `W6 text lines ${width}`).toBeGreaterThan(0);
    for (const box of boxes.lines) {
      const match=box.color.match(/[\d.]+/g)!; const foreground=luminance(+match[0],+match[1],+match[2]); let background=0;
      if (box.buttonBg) {
        const rgb=box.buttonBg.match(/[\d.]+/g)!;
        background=luminance(+rgb[0],+rgb[1],+rgb[2]);
      } else {
        for(let y=Math.max(0,Math.floor(box.y-before.y));y<Math.min(info.height,Math.ceil(box.bottom-before.y));y++) for(let x=Math.max(0,Math.floor(box.x-before.x));x<Math.min(info.width,Math.ceil(box.right-before.x));x++) { const i=(y*info.width+x)*info.channels; background=Math.max(background,luminance(data[i],data[i+1],data[i+2])); }
      }
      expect((Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05), `W6 contrast ${width}: ${box.text}`).toBeGreaterThanOrEqual(4.5);
    }
    const roi = width<=430 ? [0,430,info.width,560] : [Math.round(info.width*.32),260,Math.round(info.width*.62),690];
    const roiStats = (shot: typeof image) => {
      const maxChannels: number[] = []; let art=0;
      for (let y=roi[1];y<roi[3];y++) for (let x=roi[0];x<roi[2];x++) {
        const i=(y*shot.info.width+x)*shot.info.channels;
        const max=Math.max(shot.data[i],shot.data[i+1],shot.data[i+2]);
        maxChannels.push(max); if (max>25) art++;
      }
      maxChannels.sort((a,b)=>a-b);
      return { art, p95:maxChannels[Math.floor(maxChannels.length*.95)] };
    };
    const overlay = roiStats(image);
    if (width<=430) expect(overlay.p95, `W9a upper ${width}`).toBeLessThanOrEqual(66);
    else expect(overlay.art, `W9c fade ${width}`).toBeLessThanOrEqual(2000);
    await page.addStyleTag({ content: ".welcome-art img{visibility:hidden!important}" });
    const control=await pixels(await page.screenshot({clip, fullPage: true})); let controlArt=0, controlRed=0;
    for(let i=0;i<control.data.length;i+=control.info.channels) { const [r,g,b]=control.data.subarray(i,i+3); if(Math.max(r,g,b)>25) controlArt++; if(r>140 && r>1.7*g && r>1.5*b) controlRed++; }
    expect(controlArt, `control art ${width}`).toBe(0); expect(controlRed, `control red ${width}`).toBe(0);
    expect(roiStats(control).art, `W9-control ${width}`).toBe(0);
    if ([320,1440].includes(width)) {
      await page.emulateMedia({colorScheme:"light"});
      expect(await page.locator(".welcome").evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(9, 9, 11)");
      await page.addStyleTag({content:".welcome-art img{visibility:visible!important}"});
      const light=await pixels(await page.screenshot({clip, fullPage: true})); let lightCount=0;
      for(let i=0;i<light.data.length;i+=light.info.channels) if(Math.max(light.data[i],light.data[i+1],light.data[i+2])>25) lightCount++;
      expect(lightCount, `W7 ${width}`).toBe(count);
      await page.emulateMedia({colorScheme:"dark"});
    }
  }
});
