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
test("the delivered image takes the placeholder's slot and the card keeps its height: nothing moves while it fades", async ({ page }) => {
  const app = path.join(test.info().project.testDir, "..", "..");
  const bundle = await build({
    stdin: { contents: `import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom";
      import {GenerationDelivery} from "@/components/creative/generation-delivery";
      const src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='red'/%3E%3C/svg%3E";
      const root=createRoot(document.getElementById("root"));
      window.stage=(stage)=>flushSync(()=>root.render(<GenerationDelivery state={{id:"probe",stage,reviewed:0,total:1}} portrait={false} images={stage==="generating"?[]:[{id:"probe-image",src,alt:"Delivered"}]}/>));`, resolveDir: app, loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", alias: { "@": path.join(app, "src") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const css = ["tokens.css", "globals.css", "review.css"].map(f => readFileSync(path.join(app, "src", "app", f), "utf8")).join("\n");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent("<style>" + css + "</style><div style='height:300px'></div><div id=root></div><div id=after style='height:2000px'>result</div>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const stage = (s: string) => page.evaluate(s => (window as unknown as { stage: (s: string) => void }).stage(s), s);
  const box = (sel: string) => page.evaluate(sel => { const r = document.querySelector(sel)!.getBoundingClientRect(); return [r.top, r.left, r.width, r.height]; }, sel);
  const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(2));
  await stage("generating");
  // Let the smooth scroll that centres the waiting card finish first (as the real-studio test below does); otherwise it is
  // still running when the measurement starts and reads as movement that has nothing to do with the image landing.
  await page.waitForTimeout(900);
  await page.evaluate(() => scrollTo(0, 120));
  const slot = await box(".delivery-placeholder"), after = await box("#after"), card = await box(".generation-delivery");
  expect(slot[3]).toBeGreaterThan(200);
  await stage("image-ready");
  const at = (ms: number) => page.evaluate(ms => { for (const a of document.getAnimations()) if ((a as CSSAnimation).animationName === "delivery-exit") { a.pause(); a.currentTime = ms; } }, ms);
  for (const ms of [0, 50, 100, 199]) {
    await at(ms);
    near(await box(".delivery-placeholder.leaving"), slot);
    near(await box(".delivery-result"), slot);
    near(await box("#after"), after);
    near(await box(".generation-delivery"), card);
  }
  await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
  await expect(page.locator(".delivery-placeholder")).toHaveCount(0);
  near(await box(".delivery-result"), slot);
  near(await box("#after"), after);
  // The delivered image revealed on its real load, then sits still.
  await expect(page.locator(".delivery-result img")).toHaveAttribute("alt", "Delivered");
  await expect(page.locator(".delivery-result img")).not.toHaveClass(/delivery-reveal/, { timeout: 2000 });
  expect(await page.locator(".delivery-result img").evaluate(img => getComputedStyle(img).opacity)).toBe("1");
});

// The real studio, frame by frame: from the last waiting frame until well after the placeholder is gone, the content
// around the delivery (the API activity row and the result below) moves no more than 2 px, and the delivered image
// appears in the box the placeholder held.
test("nothing on the page moves when a generated thumbnail lands", async ({ page }) => {
  for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(size);
    const studio = await revealStudio(page);
    let release!: () => void; const hold = new Promise<void>(r => release = r);
    await studio.generate(1, { holdGenerate: hold });
    const placeholder = page.locator(".delivery-placeholder");
    await expect(placeholder).toBeVisible();
    await page.waitForTimeout(900); // the smooth scroll that centres the placeholder has ended
    // Frame it the way a person watching it would: the placeholder centred, so the result heading may sit at the fold.
    await placeholder.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(200);
    await page.evaluate(() => { type F = { title: string; row: number | null; result: number | null; slot: number[] | null; tray: number[] | null };
      const w = window as unknown as { frames: F[]; sampling: boolean }; w.frames = []; w.sampling = true;
      const rect = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.top, r.left, r.width, r.height]; };
      const tick = () => { w.frames.push({ title: document.querySelector(".review-summary")?.textContent ?? "", row: rect(document.querySelector(".activity-summary"))?.[0] ?? null,
          result: rect(document.querySelector(".review-canvas .result-image"))?.[0] ?? null, slot: rect(document.querySelector(".delivery-placeholder:not(.leaving)")), tray: rect(document.querySelector(".delivery-result")) });
        if (w.sampling) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); });
    release();
    await expect(placeholder).toHaveCount(0, { timeout: 5000 });
    await page.waitForTimeout(600);
    const frames = await page.evaluate(() => { const w = window as unknown as { frames: { title: string; row: number | null; result: number | null; slot: number[] | null; tray: number[] | null }[]; sampling: boolean }; w.sampling = false; return w.frames; });
    const label = size.width + "px";
    // Focus moves to the result heading (for keyboard and screen readers) without scrolling the page.
    await expect(page.locator(".result-section h1, .result-section h2").first()).toBeFocused();
    expect(frames.some(f => f.title.includes("Fixture result 1")), label).toBe(true);
    for (const key of ["row", "result"] as const) {
      const tops = frames.map(f => f[key]).filter((v): v is number => v !== null);
      expect(tops.length, label + " " + key).toBe(frames.length);
      expect(Math.max(...tops) - Math.min(...tops), `${label} ${key} tops ${[...new Set(tops)].join(",")}`).toBeLessThanOrEqual(2);
    }
    const slot = frames.filter(f => f.slot).at(-1)!.slot!, trays = frames.filter(f => f.tray).map(f => f.tray!);
    expect(trays.length, label).toBeGreaterThan(10);
    for (const t of trays) for (let i = 0; i < 4; i++) expect(Math.abs(t[i] - slot[i]), label + " tray vs slot").toBeLessThanOrEqual(2);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
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

// The real studio in real time, every frame (no paused clock): the delivered images' blur-to-sharp reveal must play in plain
// view. It starts only once the fading placeholder has gone, from full blur, runs about 450 ms, and a batch keeps its 70 ms
// order (Critiquito #27 rewrite round 3: a reveal that ran under the 200 ms placeholder fade was imperceptible).
test("the delivered images blur to sharp in plain view: the reveal starts once the placeholder has gone, 70 ms apart in order", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const studio = await revealStudio(page);
  let release!: () => void; const hold = new Promise<void>(r => release = r);
  await studio.generate(4, { holdGenerate: hold });
  const placeholder = page.locator(".delivery-placeholder");
  await expect(placeholder).toBeVisible();
  await page.waitForTimeout(900);
  await placeholder.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }));
  await page.evaluate(() => {
    type Frame = { t: number; ph: number | null; imgs: { blur: number; opacity: number; cls: string; delay: string }[] };
    const w = window as unknown as { frames: Frame[]; sampling: boolean }; w.frames = []; w.sampling = true;
    const tick = () => {
      const ph = document.querySelector(".delivery-placeholder");
      w.frames.push({ t: performance.now(), ph: ph ? Number(getComputedStyle(ph).opacity) : null,
        imgs: [...document.querySelectorAll<HTMLImageElement>(".delivery-result img")].map(img => { const s = getComputedStyle(img);
          return { blur: Number(s.filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? 0), opacity: Number(s.opacity), cls: img.className, delay: s.animationDelay }; }) });
      if (w.sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  release();
  await expect(placeholder).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".delivery-result img")).toHaveCount(4);
  await expect(page.locator(".delivery-result img.delivery-reveal, .delivery-result img.delivery-reveal-pending")).toHaveCount(0, { timeout: 3000 });
  type Frame = { t: number; ph: number | null; imgs: { blur: number; opacity: number; cls: string; delay: string }[] };
  const frames = await page.evaluate(() => { const w = window as unknown as { frames: Frame[]; sampling: boolean }; w.sampling = false; return w.frames; });
  // Never under the overlay: while any of the placeholder still shows, every delivered image is still fully hidden.
  for (const f of frames) if (f.ph !== null && f.ph > 0) for (const img of f.imgs) expect(img.opacity, `image visible under the placeholder (opacity ${f.ph}) at ${f.t}`).toBe(0);
  // The reveal starts from full blur with nothing over it, and its in-between is on screen for real frames.
  const firstVisible = frames.find(f => f.imgs.some(i => i.opacity > 0))!;
  expect(firstVisible.ph).toBeNull();
  expect(firstVisible.imgs[0].blur).toBeGreaterThanOrEqual(8);
  const inBetween = frames.filter(f => f.ph === null && f.imgs[0] && f.imgs[0].blur >= 2 && f.imgs[0].blur < 12 && f.imgs[0].opacity > 0.05 && f.imgs[0].opacity < 1);
  expect(inBetween.length, "frames showing the first image part-blurred in plain view").toBeGreaterThanOrEqual(4);
  // Still visibly sharpening past 150 ms (Lead spec 2026-11-13, --ease-out-count): real frames 150 ms after the first visible
  // one keep at least 2px of blur, and the next 150 ms still take off at least 1px more. The global --ease-out failed this.
  const blurAt = (ms: number) => frames.find(f => f.t >= firstVisible.t + ms)!.imgs[0].blur;
  expect(blurAt(150), "blur 150 ms into the reveal").toBeGreaterThanOrEqual(2);
  expect(blurAt(150) - blurAt(300), "blur still dropping between 150 and 300 ms").toBeGreaterThanOrEqual(1);
  // About 450 ms from its first visible frame to sharp.
  const sharp = frames.find(f => f.t > firstVisible.t && f.imgs[0].blur === 0 && f.imgs[0].opacity === 1)!;
  expect(sharp.t - firstVisible.t).toBeGreaterThan(300);
  expect(sharp.t - firstVisible.t).toBeLessThan(700);
  // One batch, staggered 70 ms apart in rendered order, all started together.
  const running = frames.find(f => f.imgs.length === 4 && f.imgs.every(i => i.cls === "delivery-reveal"))!;
  expect(running.imgs.map(i => i.delay)).toEqual(["0s", "0.07s", "0.14s", "0.21s"]);
});

// The real GenerationDelivery and the real app CSS, frame by frame (independent check of #27 at 214e6bf): once the placeholder
// has gone, a delivered image whose bytes are still on the way says "Loading image…" on screen instead of leaving a blank tile;
// one that loaded under the placeholder goes straight into its reveal and never flashes the label; a failed one says it didn't
// load and never animates; reduced motion shows the same label, then fades the image in.
test("a delivered image still loading says so once the placeholder has gone; one that loaded under it never flashes the label", async ({ page }) => {
  const app = path.join(test.info().project.testDir, "..", "..");
  const bundle = await build({
    stdin: { contents: `import {createRoot} from "react-dom/client"; import {flushSync} from "react-dom";
      import {GenerationDelivery} from "@/components/creative/generation-delivery";
      const root=createRoot(document.getElementById("root"));
      window.stage=(stage,src)=>flushSync(()=>root.render(<GenerationDelivery state={{id:"probe",stage,reviewed:0,total:1}} portrait={false} images={stage==="generating"?[]:[{id:src,src,alt:"Delivered"}]}/>));`, resolveDir: app, loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", alias: { "@": path.join(app, "src") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const css = ["tokens.css", "globals.css", "review.css"].map(f => readFileSync(path.join(app, "src", "app", f), "utf8")).join("\n");
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'><rect width='16' height='9' fill='red'/></svg>";
  const instant = "data:image/svg+xml," + encodeURIComponent(svg);
  type Frame = { t: number; ph: boolean; label: string | null; cls: string | null; img: number | null; anim: string | null };
  const mount = async (reduced: boolean) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    let release!: () => void; const held = new Promise<void>(r => release = r);
    await page.route("https://assets.test/**", async route => {
      await held;
      if (route.request().url().includes("missing")) return route.fulfill({ status: 404, body: "missing" });
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg });
    });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent("<style>" + css + "</style><div id=root></div>");
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(() => (window as unknown as { stage: (s: string) => void }).stage("generating"));
    await page.waitForTimeout(300);
    // Every painted frame: is the placeholder there, and does the tile show a label (content, displayed, not transparent)?
    await page.evaluate(() => {
      const w = window as unknown as { frames: Frame[]; sampling: boolean }; w.frames = []; w.sampling = true;
      const tick = () => {
        const tile = document.querySelector(".delivery-tile"), img = tile?.querySelector("img"), after = tile ? getComputedStyle(tile, "::after") : null;
        w.frames.push({ t: performance.now(), ph: !!document.querySelector(".delivery-placeholder"),
          label: after && after.content !== "none" && after.display !== "none" && Number(after.opacity) > 0 ? after.content : null,
          cls: img ? img.className : null, img: img ? Number(getComputedStyle(img).opacity) : null, anim: img ? getComputedStyle(img).animationName : null });
        if (w.sampling) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return release;
  };
  const deliver = (src: string) => page.evaluate(src => (window as unknown as { stage: (s: string, src: string) => void }).stage("image-ready", src), src);
  const frames = () => page.evaluate(() => { const w = window as unknown as { frames: Frame[]; sampling: boolean }; w.sampling = false; return w.frames; });
  const tile = page.locator(".delivery-tile"), img = page.locator(".delivery-tile img"), placeholder = page.locator(".delivery-placeholder");
  // Painted proof, not computed style alone: the tile's own screenshot carries light text pixels (the label), not a blank tile.
  const textPixels = async () => {
    const shot = (await tile.screenshot()).toString("base64");
    return page.evaluate(async b64 => {
      const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext("2d")!; g.drawImage(bitmap, 0, 0);
      const d = g.getImageData(0, 0, bitmap.width, bitmap.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 90 && d[i + 1] > 90 && d[i + 2] > 90) n++;
      return n;
    }, shot);
  };
  // Round 2: a waiting tile sweeps without words (content ""), so the "label" is the painted sweep overlay itself.
  const loadingLabel = /^""$/;
  const sweeping = () => tile.evaluate(el => { const a = getComputedStyle(el, "::after"); return a.content === '""' && a.display !== "none" && a.backgroundImage.includes("gradient"); });

  // 1. Slow bytes, full motion: blank never, label as soon as the placeholder has gone, then the reveal takes over.
  let release = await mount(false);
  await deliver("https://assets.test/slow.png");
  await expect(placeholder).toHaveCount(0, { timeout: 2000 });
  await page.waitForTimeout(400);
  expect(await img.getAttribute("class")).toBe("delivery-reveal-pending");
  expect(await sweeping(), "the waiting tile paints its sweep").toBe(true);
  release();
  await expect(img).not.toHaveClass(/delivery-reveal/, { timeout: 3000 });
  expect(await textPixels(), "the image itself, red, has no light text pixels").toBe(0);
  let f = await frames();
  for (const x of f) if (x.ph) expect(x.label, `label under the placeholder at ${x.t}`).toBeNull();
  const gone = f.find(x => !x.ph)!.t, landed = f.find(x => x.cls === "delivery-reveal")!.t;
  const waiting = f.filter(x => x.t > gone + 50 && x.t < landed);
  expect(waiting.length, "frames held after the placeholder went").toBeGreaterThan(10);
  for (const x of waiting) expect(x.label ?? "", `blank tile while the bytes are on the way at ${x.t}`).toMatch(loadingLabel);
  for (const x of f.filter(x => x.cls === "delivery-reveal" || x.cls === "")) expect(x.label, `label over the revealing image at ${x.t}`).toBeNull();
  expect(f.some(x => x.cls === "delivery-reveal" && x.img! > 0 && x.img! < 1), "the reveal still plays").toBe(true);

  // 2. Bytes already there under the placeholder: never a frame of the label, before, during or after the exit; the reveal plays.
  for (let run = 0; run < 3; run++) {
    await mount(false);
    await deliver(instant);
    await expect(placeholder).toHaveCount(0, { timeout: 2000 });
    await expect(img).not.toHaveClass(/delivery-reveal/, { timeout: 3000 });
    f = await frames();
    for (const x of f) expect(x.label, `label flashed at ${x.t} (placeholder ${x.ph}, image ${x.cls})`).toBeNull();
    expect(f.some(x => x.cls === "delivery-reveal")).toBe(true);
  }

  // 3. Bytes that fail: the loading label, then the failure label; the image never animates.
  release = await mount(false);
  await deliver("https://assets.test/missing.png");
  await expect(placeholder).toHaveCount(0, { timeout: 2000 });
  await page.waitForTimeout(300);
  expect(await sweeping()).toBe(true);
  release();
  await expect(tile).toHaveAttribute("data-load", "failed");
  expect(await tile.evaluate(el => getComputedStyle(el, "::after").content)).toContain("Didn’t load");
  f = await frames();
  expect(f.some(x => loadingLabel.test(x.label ?? "")), "loading label before the failure").toBe(true);
  expect(f.every(x => x.cls !== "delivery-reveal"), "a failed image never animates").toBe(true);

  // 4. Reduced motion: no placeholder exit, the same label while the bytes are on the way, then a plain fade.
  release = await mount(true);
  await deliver("https://assets.test/slow.png");
  await expect(placeholder).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await sweeping()).toBe(true);
  release();
  await expect(img).not.toHaveClass(/delivery-reveal/, { timeout: 3000 });
  f = await frames();
  expect(f.filter(x => x.cls === "delivery-reveal").every(x => x.anim === "delivery-reveal-fade" && x.label === null)).toBe(true);
  expect(await img.evaluate(el => getComputedStyle(el).opacity)).toBe("1");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
