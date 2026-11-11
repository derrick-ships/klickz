import { test, expect, type Page } from "@playwright/test";
import { revealStudio, recordReveals, reveals, clearReveals, starts } from "./helpers/image-reveal";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
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
  // A failed thumbnail says so in its own slot and points to the canvas, which offers Refresh preview, instead of a bare broken-image icon.
  await expect(failed).toHaveAttribute("data-load", "failed");
  const note = await failed.evaluate(el => { const s = getComputedStyle(el.parentElement!, "::after"); return { content: s.content, bg: s.backgroundColor }; });
  expect(note.content).toContain("Image didn’t load");
  expect(note.content).toContain("Open it to refresh");
  expect(note.bg).toBe("rgb(24, 24, 24)");
  await expect(page.locator(".chat-timeline img[data-load='failed']")).toHaveCount(1);
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

// Deterministic component check: the real GenerationDelivery and the real app CSS. Turning reduced motion on while the
// placeholder fades out cancels its exit animation (the global reduced-motion reset), so animationend never fires:
// the placeholder must still go, leaving the caption, never a stranded, hidden-but-sized block.
test("turning reduced motion on mid-exit still removes the generating placeholder", async ({ page }) => {
  const app = path.join(test.info().project.testDir, "..", "..");
  const bundle = await build({
    stdin: { contents: `import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom";
      import {GenerationDelivery} from "@/components/creative/generation-delivery";
      const root=createRoot(document.getElementById("root"));
      window.stage=(stage)=>flushSync(()=>root.render(<GenerationDelivery state={{id:"probe",stage}} portrait={false}/>));`, resolveDir: app, loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", alias: { "@": path.join(app, "src") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const css = ["tokens.css", "globals.css", "review.css"].map(f => readFileSync(path.join(app, "src", "app", f), "utf8")).join("\n");
  const stage = (s: string) => page.evaluate(s => (window as unknown as { stage: (s: string) => void }).stage(s), s);
  for (const paused of [true, false]) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setContent("<style>" + css + "</style><div id=root></div>");
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const placeholder = page.locator(".delivery-placeholder");
    await stage("generating");
    await expect(placeholder).toBeVisible();
    await stage("ready");
    // Paused: the switch always lands mid-fade. Unpaused: the real-time race the reviewer reproduced.
    if (paused) await page.evaluate(() => document.querySelector(".delivery-placeholder")!.getAnimations().forEach(a => a.pause()));
    await expect(page.locator(".delivery-placeholder.leaving")).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(placeholder).toHaveCount(0, { timeout: 1000 });
    await expect(page.getByRole("status")).toBeVisible();
  }
});

// Deterministic component check: the exit gives the placeholder's space back while it fades, so the image and
// status below rise with it instead of jumping up when it is removed (Critiquito #27 fix2 round 2).
test("the placeholder's space collapses during its fade, with no jump when it is removed", async ({ page }) => {
  const app = path.join(test.info().project.testDir, "..", "..");
  const bundle = await build({
    stdin: { contents: `import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom";
      import {GenerationDelivery} from "@/components/creative/generation-delivery";
      const root=createRoot(document.getElementById("root"));
      window.stage=(stage)=>flushSync(()=>root.render(<GenerationDelivery state={{id:"probe",stage}} portrait={false}/>));`, resolveDir: app, loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", alias: { "@": path.join(app, "src") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const css = ["tokens.css", "globals.css", "review.css"].map(f => readFileSync(path.join(app, "src", "app", f), "utf8")).join("\n");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent("<style>" + css + "</style><div id=root></div>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const stage = (s: string) => page.evaluate(s => (window as unknown as { stage: (s: string) => void }).stage(s), s);
  // Distance from the top of the delivery card to its caption: the space the placeholder still takes.
  const offset = () => page.evaluate(() => document.querySelector(".delivery-caption")!.getBoundingClientRect().top - document.querySelector(".generation-delivery")!.getBoundingClientRect().top - 1);
  await stage("generating");
  const full = await offset();
  expect(full).toBeGreaterThan(200);
  await stage("ready");
  const at = (ms: number) => page.evaluate(ms => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, ms).then(offset);
  expect(await at(0)).toBeGreaterThan(full - 2);
  expect(await at(100)).toBeLessThan(full * 0.6);
  expect(await at(199)).toBeLessThan(8);
  await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
  await expect(page.locator(".delivery-placeholder")).toHaveCount(0);
  expect(await offset()).toBeLessThan(1);
});

// Deterministic component check: the real RevealImage and the real app CSS, with a controlled clock for the
// reveal registry, so the remount always lands inside the 120 ms reduced-motion window.
test("reduced motion: a remount mid-fade continues the fade instead of starting over, with no stagger", async ({ page }) => {
  const app = path.join(test.info().project.testDir, "..", "..");
  const bundle = await build({
    stdin: { contents: `import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom";
      import {RevealImage,setRevealOwner} from "@/components/creative/image-reveal";
      const src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='red'/%3E%3C/svg%3E";
      setRevealOwner("probe"); const root=createRoot(document.getElementById("root")); let n=0;
      const render=(id,index)=>flushSync(()=>root.render(<RevealImage key={n++} surface="canvas" creationId={id} index={index} arrival={{batch:1,index}} src={src}/>));
      window.mount=render;`, resolveDir: app, loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", alias: { "@": path.join(app, "src") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const css = ["globals.css", "review.css"].map(f => readFileSync(path.join(app, "src", "app", f), "utf8")).join("\n");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent("<style>" + css + "</style><div id=root></div>");
  await page.evaluate(() => { const w = window as unknown as { clock: number }; w.clock = 1000; performance.now = () => w.clock; });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const reveal = (id: string, index: number) => page.evaluate(async ({ id, index }) => {
    (window as unknown as { mount: (id: string, index: number) => void }).mount(id, index);
    const img = () => document.querySelector("img")!;
    for (let i = 0; i < 120 && img().className.includes("pending"); i++) await new Promise(r => requestAnimationFrame(r));
    const a = img().getAnimations()[0] as CSSAnimation | undefined;
    return { cls: img().className, name: a?.animationName ?? "", delay: getComputedStyle(img()).animationDelay, progress: Number(a?.effect?.getComputedTiming().progress ?? -1) };
  }, { id, index });
  // A fresh reveal at batch position 1 fades at once: no stagger with reduced motion.
  const fresh = await reveal("second", 1);
  expect(fresh).toMatchObject({ cls: "image-reveal", name: "image-reveal-fade", delay: "0s" });
  // 60 ms into a 120 ms fade, the image remounts (preview toggle, URL refresh): it must continue from 60 ms.
  await reveal("first", 0);
  await page.evaluate(() => { (window as unknown as { clock: number }).clock += 60; });
  const resumed = await reveal("first", 0);
  expect(resumed).toMatchObject({ cls: "image-reveal", name: "image-reveal-fade", delay: "-0.06s" });
  expect(resumed.progress).toBeGreaterThanOrEqual(0.5);
});
