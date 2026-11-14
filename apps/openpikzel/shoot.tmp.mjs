import { chromium } from "playwright";
const base = process.argv[2] || "https://openpikzels.com";
const out = process.argv[3] || "/tmp/ui-before";
const b = await chromium.launch();
for (const [w,h,tag] of [[1440,900,"desktop"],[390,844,"mobile"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base + "/", { waitUntil: "networkidle" }); await p.screenshot({ path: `${out}/home-${tag}.png`, fullPage: true });
  await p.goto(base + "/studio", { waitUntil: "networkidle" }); await p.waitForTimeout(1200); await p.screenshot({ path: `${out}/studio-${tag}.png`, fullPage: true });
  await p.screenshot({ path: `${out}/studio-${tag}-fold.png` });
  await p.goto(base + "/connect", { waitUntil: "networkidle" }); await p.screenshot({ path: `${out}/connect-${tag}.png`, fullPage: true });
  await p.close();
}
await b.close();
