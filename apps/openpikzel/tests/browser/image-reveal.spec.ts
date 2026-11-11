import { test, expect, type Page } from "@playwright/test";
import { revealStudio, recordReveals, reveals, clearReveals, starts } from "./helpers/image-reveal";
// OP-10: blur-to-sharp reveal with staggered batches. Every request is a local fixture; no provider is called.

const canvasImg = (page: Page) => page.locator(".review-canvas .result-image img");
const library = (page: Page) => page.getByRole("button", { name: "My creations", exact: true });
const openCard = (page: Page, title: string) => page.locator(".creation-card").filter({ has: page.getByText(title, { exact: true }) }).locator(".creation-card-info button").first();
const settle = (page: Page) => page.evaluate(() => document.getAnimations().forEach(a => { if ((a as CSSAnimation).animationName?.startsWith("image-reveal")) a.finish(); }));

test("a 4-image batch staggers its thumbnails 70 ms apart, left to right; older images, the library and revisits stay still", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordReveals(page);
  const studio = await revealStudio(page);
  await studio.open();
  // Hold each reveal on creation so its timing can be read exactly.
  await page.evaluate(() => { const w = window as any; w.__pause = (e: AnimationEvent) => { if (e.animationName === "image-reveal") (e.target as Element).getAnimations().forEach(a => a.pause()); }; document.addEventListener("animationstart", w.__pause, true); });
  await studio.generate(4);
  await expect(page.locator(".review-summary")).toContainText("Fixture result 1");
  const strip = page.locator(".chat-timeline img");
  await expect(strip).toHaveCount(5);
  await expect.poll(async () => (await starts(page)).filter(e => e.surface === "strip").length).toBe(4);
  // The strip lists oldest first: start image (still), then results 4, 3, 2, 1 revealing 0/70/140/210 ms after their loads.
  const timing = await strip.evaluateAll(els => els.map(el => { const a = el.getAnimations()[0] as CSSAnimation | undefined; return a ? { alt: el.getAttribute("alt"), name: a.animationName, delay: a.effect!.getTiming().delay, duration: a.effect!.getTiming().duration } : { alt: el.getAttribute("alt") }; }));
  expect(timing).toEqual([{ alt: "Fixture start image 1" }, ...[4, 3, 2, 1].map((n, i) => ({ alt: "Fixture result " + n, name: "image-reveal", delay: i * 70, duration: 450 }))]);
  // At the same moment (100ms in), the first is mid-reveal while the last still holds its hidden, blurred first
  // frame through its delay (fill: both), so a late thumbnail never flashes sharp first.
  const at100 = await strip.evaluateAll(els => els.slice(1).map(el => { const a = el.getAnimations()[0]; a.pause(); a.currentTime = 100; const s = getComputedStyle(el); return { opacity: Number(s.opacity), filter: s.filter }; }));
  expect(at100[0].opacity).toBeGreaterThan(0.2); expect(at100[0].opacity).toBeLessThan(1);
  expect(at100[3]).toEqual({ opacity: 0, filter: "blur(12px)" });
  await page.evaluate(() => document.removeEventListener("animationstart", (window as any).__pause, true));
  await settle(page);
  // Let the real-time reveal windows pass (a remount inside one continues the reveal, by design).
  await page.waitForTimeout(800);
  await clearReveals(page);
  // The library is a revisit of the same thumbnails: still.
  await library(page).click();
  await expect(page.locator(".creation-card-image img")).toHaveCount(5);
  await page.waitForTimeout(600);
  expect(await starts(page)).toEqual([]);
  // Result 3 has not been shown large yet, so the canvas reveals it once; revisits of results 1 and 3 stay still.
  await openCard(page, "Fixture result 3").click();
  await expect(page.locator(".review-summary")).toContainText("Fixture result 3");
  await expect.poll(async () => (await starts(page)).map(e => e.surface)).toEqual(["canvas"]);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Open Fixture result 1", exact: true }).click();
  await expect(page.locator(".review-summary")).toContainText("Fixture result 1");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Open Fixture result 3", exact: true }).click();
  await expect(canvasImg(page)).toHaveCSS("opacity", "1");
  await page.waitForTimeout(600);
  expect((await starts(page)).map(e => e.surface)).toEqual(["canvas"]);
  // A reload (and history navigation, which reloads this app) shows everything still.
  await clearReveals(page);
  await page.reload();
  await expect(page.locator(".review-summary")).toBeVisible();
  await expect(strip).toHaveCount(5);
  await library(page).click();
  await expect(page.locator(".creation-card-image img")).toHaveCount(5);
  await page.waitForTimeout(600);
  expect(await starts(page)).toEqual([]);
  expect((await reveals(page)).every(e => !e.cls.includes("image-reveal"))).toBe(true);
});

test("a partial batch reveals only what arrived; a failed image never animates", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordReveals(page);
  const studio = await revealStudio(page);
  studio.rule(1, { fail: true });
  await studio.generate(4, { partial: 3 });
  await expect(page.getByRole("alert").filter({ hasText: "the batch stopped" })).toBeVisible();
  const strip = page.locator(".chat-timeline img");
  await expect(strip).toHaveCount(4);
  await expect.poll(async () => (await starts(page)).filter(e => e.surface === "strip").length).toBe(2);
  const failed = page.locator(".chat-timeline img[alt='Fixture result 2']");
  await expect.poll(() => failed.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 0)).toBe(true);
  await expect(failed).not.toHaveClass(/image-reveal/);
  await expect(failed).toHaveCSS("animation-name", "none");
  await expect(failed).toHaveCSS("opacity", "1");
  // Three arrived (results 3, 2, 1 left to right); the failed middle one keeps its slot, the others reveal at 0 and 140 ms.
  expect((await starts(page)).filter(e => e.surface === "strip").map(e => [e.src?.match(/image-\d/)![0], e.delay])).toEqual([["image-2", "0s"], ["image-0", "0.14s"]]);
  // The failed image on the canvas shows the existing error, also without any reveal.
  await page.getByRole("button", { name: "Open Fixture result 2", exact: true }).click();
  await expect(page.getByText("This preview could not load.")).toBeVisible();
  await page.waitForTimeout(500);
  expect((await starts(page)).filter(e => e.surface === "canvas" && e.src?.includes("image-1"))).toEqual([]);
});

test("slow images hold their space, show loading, and reveal only when the bytes land", async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await recordReveals(page);
    const studio = await revealStudio(page, { start: [{ title: "Fixture start image 1 with a very long title that keeps going well past the width of a phone screen so it has to wrap" }] });
    let release!: () => void; const hold = new Promise<void>(r => release = r);
    studio.rule(0, { hold });
    const long = "A very long prompt about a creator rebuilding a whole studio in seven days, with a red neon sign, a cluttered desk, three monitors, a cat, and a giant hand-written headline that says SEVEN DAYS";
    await studio.generate(1, { prompt: long });
    const img = canvasImg(page);
    await expect(page.locator(".review-summary")).toContainText("Fixture result 1");
    await expect(page.locator(".review-canvas")).toHaveAttribute("aria-busy", "true");
    await page.waitForTimeout(400);
    // Layout boxes (offset*), not painted boxes: the 1.02 scale is a visual transform and must not move layout.
    const layout = () => img.evaluate((el: HTMLElement) => { let y = 0; for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop; return { y, height: el.offsetHeight, width: el.offsetWidth }; });
    const before = await layout();
    expect(await starts(page)).toEqual([]);
    // The waiting thumbnail slot is labelled, never an empty box; the label goes once the reveal starts.
    const slot = page.locator(".chat-timeline article button:has(> img.image-reveal-pending)");
    await expect(slot).toHaveCount(1);
    expect(await slot.evaluate(el => getComputedStyle(el, "::after").content)).toContain("Loading image");
    release();
    await expect(img).toHaveClass(/(^| )image-reveal( |$)/);
    const during = await layout();
    await settle(page);
    await expect(slot).toHaveCount(0);
    const after = await layout();
    // Reserved by the intrinsic width/height: no layout shift when the image arrives or settles (transform is visual only).
    for (const box of [during, after]) expect(box).toEqual(before);
    await expect(page.locator(".review-canvas")).toHaveAttribute("aria-busy", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("switching selection or preview mid-reveal never restarts it, and a fast regenerate reveals the new image", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordReveals(page);
  const studio = await revealStudio(page);
  await studio.generate(1);
  const img = canvasImg(page);
  await expect(img).toHaveClass(/(^| )image-reveal( |$)/);
  // Toggle the phone feed preview mid-reveal: the image remounts. It continues (negative delay) if it loads
  // inside the original 450ms window, or shows still if it loads later. It never starts over.
  await page.waitForTimeout(100);
  await clearReveals(page);
  await page.getByRole("button", { name: "Toggle phone feed preview" }).click();
  await expect(page.locator(".review-canvas[data-preview='feed'] .result-image img")).toBeVisible();
  await page.waitForTimeout(700);
  const after = (await reveals(page)).filter(e => e.surface === "canvas");
  expect(after.some(e => e.event === "mount")).toBe(true);
  expect(after.filter(e => e.event.startsWith("start:") && !e.delay.startsWith("-"))).toEqual([]);
  await expect(page.locator(".review-canvas .result-image img")).toHaveCSS("opacity", "1");
  await settle(page);
  // Fast regenerate: the next result reveals from the start, and the previous one stays still when revisited.
  await clearReveals(page);
  await page.getByRole("button", { name: "Toggle phone feed preview" }).click();
  await studio.generate(1);
  await expect(page.locator(".review-summary")).toContainText("Fixture result 2");
  await expect.poll(async () => (await starts(page)).filter(e => e.surface === "canvas" && e.src?.includes("/image-1.png")).length).toBe(1);
  await page.waitForTimeout(500);
  // Image 0 may only ever continue (negative delay) inside its original 450ms window; it never starts over.
  expect((await starts(page)).filter(e => e.surface === "canvas" && e.src?.includes("/image-0.png") && !e.delay.startsWith("-"))).toEqual([]);
  await clearReveals(page);
  await library(page).click();
  await openCard(page, "Fixture result 1").click();
  await expect(page.locator(".review-summary")).toContainText("Fixture result 1");
  await expect(img).toHaveCSS("opacity", "1");
  await page.waitForTimeout(600);
  // Result 2 was claimed when its reveal started; result 1 was revealed earlier: neither replays on the canvas.
  await library(page).click();
  await openCard(page, "Fixture result 2").click();
  await page.waitForTimeout(600);
  expect((await starts(page)).filter(e => e.surface === "canvas")).toEqual([]);
});

test("uploads and the initial library never reveal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordReveals(page);
  await page.goto("/?mode=analyze");
  await page.getByLabel("Upload thumbnail references").setInputFiles("public/brand/signal.webp");
  await expect(page.getByRole("region", { name: "Thumbnail review studio" })).toBeVisible();
  await expect(canvasImg(page)).toHaveCSS("opacity", "1");
  await page.waitForTimeout(600);
  expect(await starts(page)).toEqual([]);
  expect((await reveals(page)).every(e => !e.cls.includes("image-reveal"))).toBe(true);
});

test("the generating placeholder fades out instead of popping, and goes at once with reduced motion", async ({ page }) => {
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const studio = await revealStudio(page);
    let release!: () => void; const hold = new Promise<void>(r => release = r);
    await studio.generate(1, { holdGenerate: hold });
    const placeholder = page.locator(".delivery-placeholder");
    await expect(placeholder).toBeVisible();
    await expect(placeholder).not.toHaveClass(/leaving/);
    // Record the exit as it starts: polling for a 200 ms animation after the fact races its own end.
    await page.evaluate(() => { const w = window as unknown as { exits: { name: string; duration: string }[] }; w.exits = [];
      document.addEventListener("animationstart", e => { const el = e.target as Element; if (el.classList.contains("delivery-placeholder")) w.exits.push({ name: e.animationName, duration: getComputedStyle(el).animationDuration }); }, true); });
    // The same placeholder node must take the exit: it is never removed and re-inserted (a one-frame pop) before fading.
    await page.evaluate(() => { const w = window as unknown as { removed: string[] }; w.removed = [];
      new MutationObserver(ms => { for (const m of ms) for (const n of m.removedNodes) if (n instanceof Element && n.matches(".delivery-placeholder")) w.removed.push(n.className); }).observe(document.body, { subtree: true, childList: true }); });
    release();
    await expect(placeholder).toHaveCount(0, { timeout: reduced ? 1000 : 5000 });
    expect(await page.evaluate(() => (window as unknown as { exits: unknown[] }).exits)).toEqual(reduced ? [] : [{ name: "delivery-exit", duration: "0.2s" }]);
    const removed = await page.evaluate(() => (window as unknown as { removed: string[] }).removed);
    expect(removed).toHaveLength(1);
    expect(removed[0].includes("leaving")).toBe(!reduced);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});
