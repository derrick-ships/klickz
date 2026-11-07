import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { reviewFixture } from "./helpers/review-fixture";

test("review preview reacts within the existing feedback budget @performance", async ({ browser }) => {
  const profiles = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
    const page = await context.newPage(), errors: string[] = [], paid: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (/\/api\/(generate|analyze)$/.test(r.url())) paid.push(r.url()); });
    await reviewFixture(page);
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState === "finished"));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Performance.enable");
    const before = await cdp.send("Performance.getMetrics");
    await page.evaluate(() => {
      const w = window as any; w.__reviewFrames = []; w.__reviewLongTasks = []; w.__reviewRunning = true;
      let previous: number | undefined;
      const frame = (now: number) => { if (previous !== undefined) w.__reviewFrames.push(now - previous); previous = now; if (w.__reviewRunning) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
      w.__reviewLongTaskSupported = PerformanceObserver.supportedEntryTypes.includes("longtask");
      if (w.__reviewLongTaskSupported) { w.__reviewObserver = new PerformanceObserver(list => w.__reviewLongTasks.push(...list.getEntries().map(e => e.duration))); w.__reviewObserver.observe({ entryTypes: ["longtask"] }); }
    });
    const feedback: number[] = [], preview = page.getByRole("button", { name: "Toggle phone feed preview" });
    for (let i = 0; i < 5; i++) {
      await preview.evaluate(el => {
        (window as any).__reviewFeedback = null;
        el.addEventListener("click", () => { const start = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => { (window as any).__reviewFeedback = performance.now() - start; })); }, { once: true, capture: true });
      });
      await preview.click();
      await page.waitForFunction(() => typeof (window as any).__reviewFeedback === "number");
      feedback.push(await page.evaluate(() => (window as any).__reviewFeedback));
    }
    const sample = await page.evaluate(() => {
      const w = window as any; w.__reviewRunning = false; w.__reviewObserver?.disconnect();
      return { frameIntervals: w.__reviewFrames as number[], longTaskSupported: w.__reviewLongTaskSupported, longTasks: w.__reviewLongTasks as number[] };
    });
    const after = await cdp.send("Performance.getMetrics");
    const delta = Object.fromEntries(["LayoutCount", "RecalcStyleCount", "ScriptDuration", "TaskDuration"].map(k => [k, (after.metrics.find(x => x.name === k)?.value || 0) - (before.metrics.find(x => x.name === k)?.value || 0)]));
    profiles.push({ width, feedback_ms: feedback, ...sample, delta });
    expect(Math.max(...feedback)).toBeLessThanOrEqual(100);
    expect(sample.frameIntervals.length).toBeGreaterThan(5);
    expect(errors).toEqual([]); expect(paid).toEqual([]);
    await context.close();
  }
  const report = { method: "Local production Review Studio with explicit scored fixture; Chromium CPU4x; five preview toggles per viewport. RAF samples are not physical-device FPS, field p75 or INP.", profiles };
  await writeFile("evidence/performance-review.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(profiles.map(p => ({ width: p.width, maximumFeedbackMS: Math.max(...p.feedback_ms), frames: p.frameIntervals.length, longTasks: p.longTasks.length }))));
});
