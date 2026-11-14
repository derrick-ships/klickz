import { test, expect } from "@playwright/test";
// Exercise real touch PointerEvents alongside mouse and keyboard actions.
test.use({ hasTouch: true });

test("a successful draft locks its pixels once without delaying or replaying history", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?mode=generate");
    await page.getByLabel("Describe your thumbnail", { exact: true }).fill("");
    const save = page.getByRole("button", { name: /Save draft/ });
    await save.click();
    await expect(page.getByRole("alert").filter({ hasText: "Write a direction or title before saving." })).toBeVisible();
    await expect(save).toHaveAttribute("data-confirmed", "false");
    await expect(page.locator(".pixel-confirmation")).toHaveCount(0);
    await page.getByLabel("Describe your thumbnail", { exact: true }).fill("A clear red thumbnail concept with one unmistakable subject");
    await save.click();
    await expect(save).toHaveAttribute("data-confirmed", "true");
    await expect(page.getByRole("status").filter({ hasText: "Draft saved to your library." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Concept saved." })).toBeVisible();
    expect(await page.locator(".pixel-confirmation rect").count()).toBe(4);
    expect(await page.locator(".pixel-confirmation rect").first().evaluate(el => getComputedStyle(el).animationName)).toBe("pixel-lock");
    await page.locator(".pixel-confirmation").evaluate(el => {
      for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = 100; }
    });
    await page.screenshot({ path: `evidence/delight-save-mid-${width}.png`, fullPage: true });
    await page.locator(".pixel-confirmation").evaluate(el => { for (const a of el.getAnimations({ subtree: true })) a.finish(); });
    await page.screenshot({ path: `evidence/delight-save-settled-${width}.png`, fullPage: true });
    await save.click();
    await expect(save).toHaveAttribute("data-confirmed", "true");
    expect(await page.locator(".pixel-confirmation").count()).toBe(1);
    await page.getByLabel("Describe your thumbnail", { exact: true }).fill("An updated thumbnail concept that has not yet been saved");
    await expect(save).toHaveAttribute("data-confirmed", "false");
    await expect(page.locator(".pixel-confirmation")).toHaveCount(0);
    await page.reload();
    await expect(save).toHaveAttribute("data-confirmed", "false");
    await expect(page.locator(".pixel-confirmation")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("pointer continuity stays interruptible while keyboard navigation is immediate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mode=generate");
  const sidebar = page.locator("aside.sidebar");
  const open = page.getByRole("button", { name: "Open sidebar", exact: true });
  await open.tap();
  const duration=await sidebar.evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration.split(",")[0]));expect(duration).toBeGreaterThan(0);expect(duration).toBeLessThanOrEqual(.3);
  await page.screenshot({ path: "evidence/delight-drawer-mobile.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  expect(await sidebar.evaluate(el => getComputedStyle(el).transitionDuration.split(",")[0].trim())).toBe("0s");
  await open.press("Enter");
  await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeFocused();
  expect(await sidebar.evaluate(el => getComputedStyle(el).transitionDuration.split(",")[0].trim())).toBe("0s");
  await page.keyboard.press("Escape");
  await open.click();
  await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
  await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  await page.keyboard.press("Control+b");
  await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeFocused();
  expect(await sidebar.evaluate(el => getComputedStyle(el).transitionDuration.split(",")[0].trim())).toBe("0s");
  await page.keyboard.press("Escape");
  // Advanced controls now live in a native disclosure; reduced motion removes its arrow transition.
  const controls = page.locator("details.more-options:not(.request-readiness) > summary").first();
  await controls.click();
  const advanced = page.locator(".advanced-controls");
  await expect(advanced).toBeVisible();
  await controls.click();
  await expect(advanced).toBeHidden();
  await controls.press("Enter");
  await expect(advanced).toBeVisible();
});

test("reduced motion keeps acknowledgment with no spatial movement or new loops", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/?mode=generate");
  await page.getByLabel("Describe your thumbnail", { exact: true }).fill("A thoughtful thumbnail with clear visual direction");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".pixel-confirmation")).toBeVisible();
  const rect = page.locator(".pixel-confirmation rect").first();
  expect(await rect.evaluate(el => ({ name: getComputedStyle(el).animationName, duration: getComputedStyle(el).animationDuration, transform: getComputedStyle(el).transform, repeat: getComputedStyle(el).animationIterationCount }))).toEqual({ name: "control-confirm", duration: "0.1s", transform: "none", repeat: "1" });
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  expect(await page.locator("aside.sidebar").evaluate(el => getComputedStyle(el).transitionDuration.split(",")[0].trim())).toBe("0s");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "evidence/delight-reduced-motion-320.png", fullPage: true });
  await expect(page.locator("[data-brand-scene] source")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

// OP-11: score count-up and pillar fills (DELIGHT.md approved exception 2). Every network call is a local fixture; no provider is called.
// Animations need a score that arrives in-session (arrivalStudio: generate, then automatic review scores the selected image).
import { recordScoreTicks, seedScores, ticks, fills, clearTicks, announcements, arrivalStudio } from "./helpers/score-reveal";

const mixed = { virality: 88, clarity: 72, idea: null, curiosity: 100, emotion: 0 };
const panelOf = (page: import("@playwright/test").Page) => page.getByRole("complementary", { name: "Scoring inspector" });

test("a score arriving in-session counts up once with staggered pillar fills, announces once, and never replays", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordScoreTicks(page);
  const studio = await arrivalStudio(page);
  await studio.arrive({ overall: 72, pillars: mixed });
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  await expect(panel).toHaveAttribute("data-reveal", "settled");
  await expect(heading).toHaveText("72/100");
  await expect(page.getByRole("heading", { name: "72/100", exact: true })).toBeVisible();
  await expect(heading.locator(".score-count")).not.toHaveAttribute("aria-hidden", /.*/);
  await expect(heading.locator(".sr-only")).toHaveCount(0);

  const log = await ticks(page), running = log.filter(r => r.reveal === "running");
  expect(running.length).toBeGreaterThan(4);
  const values = running.map(r => Number(r.value));
  expect(values[0]).toBe(0);
  for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  expect(Math.max(...values)).toBeLessThanOrEqual(72);
  // Ticks are hidden from assistive tech; the accessible text holds only the final value.
  for (const r of running) { expect(r.hidden).toBe("true"); expect(r.sr).toBe("72"); }
  // The polite live region stays empty while the digits tick, then holds only the final value, once.
  for (const r of running) expect(r.announce).toBe("");
  const region = page.locator("[data-score-announcer]");
  await expect(region).toHaveCount(1);
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region).toHaveText("OpenPikzels Score 72 out of 100");
  expect((await announcements(page)).filter(a => a.text)).toEqual([{ t: expect.any(Number), text: "OpenPikzels Score 72 out of 100" }]);
  // The "/100" beside the number never moves while the digits change.
  const slash = running.map(r => r.slash!); expect(Math.max(...slash) - Math.min(...slash)).toBeLessThanOrEqual(1);
  const span = log.find(r => r.reveal === "settled" && log.indexOf(r) > log.indexOf(running[0]))!.t - running[0].t;
  expect(span).toBeGreaterThan(450); expect(span).toBeLessThan(1400);

  // Pillar bars: transform-only fill, 400ms --ease-out-count, 50ms stagger by position, once. "Not assessed" has no bar.
  expect(await fills(page)).toEqual([
    { label: "Virality score", name: "pillar-fill", delay: "0s", duration: "0.4s", easing: "cubic-bezier(0.33, 1, 0.68, 1)", iterations: "1" },
    { label: "Clarity score", name: "pillar-fill", delay: "0.05s", duration: "0.4s", easing: "cubic-bezier(0.33, 1, 0.68, 1)", iterations: "1" },
    { label: "Curiosity score", name: "pillar-fill", delay: "0.15s", duration: "0.4s", easing: "cubic-bezier(0.33, 1, 0.68, 1)", iterations: "1" },
    { label: "Emotion score", name: "pillar-fill", delay: "0.2s", duration: "0.4s", easing: "cubic-bezier(0.33, 1, 0.68, 1)", iterations: "1" },
  ]);
  expect(await panel.locator(".pillar-meter progress").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await expect(panel.getByText("Not assessed", { exact: true })).toHaveCount(1);
  await expect(panel.getByRole("progressbar", { name: "Virality score", exact: true })).toHaveAttribute("value", "88");
  await expect(panel.getByRole("progressbar", { name: "Emotion score", exact: true })).toHaveAttribute("value", "0");

  // Re-renders (pillar switches) neither replay nor re-announce it.
  await clearTicks(page);
  await panel.getByRole("button", { name: /Curiosity/ }).click();
  await page.waitForTimeout(900);
  expect((await ticks(page)).filter(r => r.reveal === "running")).toEqual([]);
  expect(await announcements(page)).toEqual([]);
  await expect(region).toHaveText("OpenPikzels Score 72 out of 100");
  // A revisit (another creation, then back) shows it still and announces nothing.
  await page.getByRole("button", { name: "Open Fixture start image", exact: true }).first().click();
  await expect(page.locator(".score-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Open Fixture result 2", exact: true }).first().click();
  await expect(heading).toHaveText("72/100");
  await page.waitForTimeout(900);
  expect((await ticks(page)).filter(r => r.reveal === "running")).toEqual([]);
  expect((await announcements(page)).filter(a => a.text)).toEqual([]);
  // Neither does a reload, nor the analysis dialog.
  await page.reload();
  await expect(heading).toHaveText("72/100");
  await page.waitForTimeout(900);
  expect((await ticks(page)).filter(r => r.reveal === "running")).toEqual([]);
  expect((await announcements(page)).filter(a => a.text)).toEqual([]);
  await panel.getByRole("button", { name: "See full score" }).click();
  await expect(page.getByRole("dialog").locator(".score-ring strong")).toHaveText("72/100");
  await expect(page.getByRole("dialog").locator(".score-ring .score-count")).not.toHaveAttribute("aria-hidden", /.*/);
  await expect(page.getByRole("dialog").locator("[data-score-announcer]")).toHaveText("");
  expect(studio.paid).toEqual(["generate", "analyze"]);
});

test("an old score shown after a reload is static even with the reveal record cleared", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordScoreTicks(page);
  await seedScores(page, [{ title: "Fixture: first result", overall: 64, pillars: { virality: 64, clarity: 64, idea: 64, curiosity: 64, emotion: 64 } },
    { title: "Fixture: second result", overall: 91, pillars: { virality: 91, clarity: 91, idea: 91, curiosity: 91, emotion: 91 } }]);
  // Simulate a fresh or evicted registry: no record says these were ever revealed.
  await page.evaluate(() => localStorage.removeItem("openpikzels:score-reveals:v1"));
  await page.reload();
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  await expect(panel).toBeVisible();
  for (const [name, final] of [["Open Fixture: second result", 91], ["Open Fixture: first result", 64]] as const) {
    await page.getByRole("button", { name, exact: true }).first().click();
    await expect(heading).toHaveText(final + "/100");
  }
  await page.waitForTimeout(900);
  const log = await ticks(page);
  expect(log.length).toBeGreaterThan(0);
  expect(log.filter(r => r.reveal === "running" || r.hidden !== null)).toEqual([]);
  expect(log.every(r => r.text === "64/100" || r.text === "91/100")).toBe(true);
  expect((await announcements(page)).filter(a => a.text)).toEqual([]);
  await expect(panel).toHaveAttribute("data-reveal", "settled");
});

test("a result arriving mid-reveal takes over from 0, and switching back shows the earlier one still", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordScoreTicks(page);
  await page.clock.install();
  const studio = await arrivalStudio(page);
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  let release!: () => void; const hold = new Promise<void>(r => release = r);
  await studio.arrive({ overall: 64, pillars: { virality: 64, clarity: 64, idea: 64, curiosity: 64, emotion: 64 } }, hold);
  // Hold the page clock so the count is frozen until the test advances it.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5000));
  release();
  await expect(panel).toHaveAttribute("data-reveal", "running");
  // Count partway, then bring in the next result.
  await page.clock.runFor(200);
  await expect(heading.locator(".sr-only")).toHaveText("64");
  expect(Number(await heading.locator(".score-count").evaluate(el => el.lastChild!.textContent))).toBeLessThan(64);
  await expect(page.getByRole("heading", { name: /^64\s?\/100$/ })).toBeVisible();
  await expect(page.locator("[data-score-announcer]")).toHaveText("");
  await clearTicks(page);
  let releaseNext!: () => void; const holdNext = new Promise<void>(r => releaseNext = r);
  await studio.arrive({ overall: 91, pillars: { virality: 91, clarity: 91, idea: 91, curiosity: 91, emotion: 91 } }, holdNext);
  releaseNext();
  await expect(heading.locator(".sr-only")).toHaveText("91");
  await page.clock.runFor(16);
  const takeover = (await ticks(page)).filter(r => r.reveal === "running");
  expect(Number(takeover[0].value)).toBeLessThan(15);
  expect(takeover.every(r => r.sr === "91" && r.hidden === "true")).toBe(true);
  await page.clock.runFor(1000);
  await expect(heading).toHaveText("91/100");
  await expect(panel).toHaveAttribute("data-reveal", "settled");
  // Only the reveal that finished is announced; the interrupted one never is.
  expect((await announcements(page)).filter(a => a.text).map(a => a.text)).toEqual(["OpenPikzels Score 91 out of 100"]);
  // Back to the first one: it was claimed when it started and is a revisit, so it shows its final value without counting.
  await clearTicks(page);
  await page.getByRole("button", { name: "Open Fixture result 2", exact: true }).first().click();
  await expect(heading).toHaveText("64/100");
  await page.clock.runFor(1000);
  expect((await ticks(page)).filter(r => r.reveal === "running")).toEqual([]);
  expect((await announcements(page)).filter(a => a.text)).toEqual([]);
});

test("reduced motion shows an arriving score at once, announces it once, and the reveal stays claimed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await recordScoreTicks(page);
  const studio = await arrivalStudio(page);
  await studio.arrive({ overall: 72, pillars: mixed });
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  await expect(heading).toHaveText("72/100");
  const log = await ticks(page);
  expect(log.length).toBeGreaterThan(0);
  expect(log.every(r => r.reveal === "settled" && r.text === "72/100" && r.hidden === null)).toBe(true);
  expect(await panel.locator(".pillar-meter progress").first().evaluate(el => ({ name: getComputedStyle(el).animationName, transform: getComputedStyle(el).transform }))).toEqual({ name: "none", transform: "none" });
  await expect(page.locator("[data-score-announcer]")).toHaveText("OpenPikzels Score 72 out of 100");
  expect((await announcements(page)).filter(a => a.text).map(a => a.text)).toEqual(["OpenPikzels Score 72 out of 100"]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await expect(heading).toHaveText("72/100");
  await page.waitForTimeout(900);
  expect((await ticks(page)).filter(r => r.reveal === "running")).toEqual([]);
  expect((await announcements(page)).filter(a => a.text)).toEqual([]);
});

test("edge scores, partial results and long labels stay steady at every width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await recordScoreTicks(page);
  const studio = await arrivalStudio(page);
  await studio.arrive({ overall: 100, pillars: { virality: 100, clarity: 0, idea: null, curiosity: null, emotion: 100 } });
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  await expect(panel).toHaveAttribute("data-reveal", "settled");
  await expect(heading).toHaveText("100/100");
  const running = (await ticks(page)).filter(r => r.reveal === "running");
  expect(running.length).toBeGreaterThan(2);
  const slash = running.map(r => r.slash!); expect(Math.max(...slash) - Math.min(...slash)).toBeLessThanOrEqual(1);
  // A long label wraps inside its pillar; the bar keeps the pillar's width.
  await panel.locator(".pillar span").first().evaluate(el => { el.textContent = "Virality across every surface where this thumbnail will appear"; });
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Measure pillar and bar in the same frame, after the resize has settled.
    await expect.poll(() => panel.locator(".pillar").first().evaluate(async el => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const pillar = el.getBoundingClientRect(), meter = el.querySelector(".pillar-meter")!.getBoundingClientRect();
      return meter.right <= pillar.right + 0.5 && meter.left >= pillar.left - 0.5 && meter.width > pillar.width * 0.6;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("a zero score settles on its first frame", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordScoreTicks(page);
  const studio = await arrivalStudio(page);
  await studio.arrive({ overall: 0, pillars: { virality: 0, clarity: 0, idea: 0, curiosity: 0, emotion: 0 } });
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  await expect(panel).toHaveAttribute("data-reveal", "settled");
  await expect(heading).toHaveText("0/100");
  expect((await ticks(page)).every(r => r.value === "0")).toBe(true);
  await expect(page.locator("[data-score-announcer]")).toHaveText("OpenPikzels Score 0 out of 100");
});

test("a partial score arriving in-session shows Partial and its bars without any reveal or announcement", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordScoreTicks(page);
  const studio = await arrivalStudio(page);
  await studio.arrive({ overall: null, pillars: { virality: 65, clarity: 65, idea: null, curiosity: null, emotion: 65 } });
  const panel = panelOf(page), heading = panel.locator(".score-header h2");
  await expect(heading).toHaveText("Partial");
  await page.waitForTimeout(900);
  expect((await ticks(page)).filter(r => r.reveal === "running")).toEqual([]);
  expect(await panel.locator(".pillar-meter progress").first().evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  expect((await announcements(page)).filter(a => a.text)).toEqual([]);
});

// OP-10: blur-to-sharp reveal (DELIGHT.md approved exception 1). Every request is a local fixture; no provider is called.
import { revealStudio } from "./helpers/image-reveal";
import sharp from "sharp";

test("a new image reveals blur-to-sharp on its real load event, and reduced motion only fades it", async ({ page }) => {
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const studio = await revealStudio(page);
    let release!: () => void; const hold = new Promise<void>(r => release = r);
    studio.rule(0, { hold });
    await studio.generate(1);
    const img = page.locator(".review-canvas .result-image img");
    await expect(page.locator(".review-summary")).toContainText("Fixture result 1");
    // Before the real image loads: hidden and not animating; the loading status holds the space.
    await expect(img).toHaveClass(/image-reveal-pending/);
    await expect(img).toHaveCSS("opacity", "0");
    await expect(img).toHaveCSS("animation-name", "none");
    await expect(page.getByText("Loading image…", { exact: true })).toBeVisible();
    // The hidden slot shows the card surface with a hairline (no border, so no layout shift), not bare black.
    const slot = page.locator(".review-canvas .result-image");
    await expect(slot).toHaveCSS("background-color", "rgb(24, 24, 24)");
    await expect(slot).toHaveCSS("box-shadow", "rgb(48, 48, 48) 0px 0px 0px 1px inset");
    await expect(slot).toHaveCSS("border-top-width", "0px");
    // What is painted, not just computed: the "Loading image…" overlay must not cover the surface with bare canvas black.
    const painted = async () => { const { data, info } = await sharp(await slot.screenshot()).raw().toBuffer({ resolveWithObject: true });
      const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
      return { inside: at(12, 12), edge: at(0, Math.floor(info.height / 2)) }; };
    expect(await painted()).toEqual({ inside: [24, 24, 24], edge: [48, 48, 48] });
    release();
    await expect(img).toHaveClass(/(^| )image-reveal( |$)/);
    const anim = await img.evaluate(el => {
      const a = el.getAnimations()[0] as CSSAnimation, t = a.effect!.getTiming();
      a.pause(); a.currentTime = 100;
      const s = getComputedStyle(el), mid = { filter: s.filter, transform: s.transform, opacity: Number(s.opacity) };
      return { name: a.animationName, duration: t.duration, delay: t.delay, easing: getComputedStyle(el).animationTimingFunction, mid };
    });
    if (!reduced) {
      expect(anim).toMatchObject({ name: "image-reveal", duration: 450, delay: 0, easing: "cubic-bezier(0.33, 1, 0.68, 1)" });
      expect(anim.mid.filter).toMatch(/^blur\((\d|\.)+px\)$/);
      expect(Number(anim.mid.filter.match(/[\d.]+/)![0])).toBeGreaterThan(0);
      expect(Number(anim.mid.filter.match(/[\d.]+/)![0])).toBeLessThan(12);
      expect(anim.mid.transform).toMatch(/^matrix\(1\.0\d+, 0, 0, 1\.0\d+, 0, 0\)$/);
    } else {
      expect(anim).toMatchObject({ name: "image-reveal-fade", duration: 120, delay: 0, easing: "linear" });
      expect(anim.mid).toMatchObject({ filter: "none", transform: "none" });
    }
    expect(anim.mid.opacity).toBeGreaterThan(0); expect(anim.mid.opacity).toBeLessThan(1);
    await img.evaluate(el => el.getAnimations().forEach(a => a.finish()));
    await expect(img).not.toHaveClass(/image-reveal/);
    await expect(img).toHaveCSS("filter", "none");
    await expect(img).toHaveCSS("opacity", "1");
    await expect(slot).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(slot).toHaveCSS("box-shadow", "none");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

// Motion #1: disclosures settle in for pointer users; keyboard opens them instantly.
test("More options and Creative chat unfold for pointer, instantly for keyboard", async ({ page }) => {
  await page.goto("/studio?mode=generate");
  const more = page.locator("details.more-options:not(.request-readiness)").first();
  await more.locator("> summary").click();
  const body = more.locator("> .more-options-body");
  expect(await body.evaluate((el) => getComputedStyle(el).animationName)).toBe("control-unfold");
  expect(await body.evaluate((el) => getComputedStyle(el).animationDuration)).toBe("0.16s");
  await more.locator("> summary").click();
  await page.locator(".creative-conversation > summary").press("Enter");
  const chat = page.locator(".creative-conversation[open] > .creative-conversation-body");
  await expect(chat).toBeVisible();
  expect(await chat.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
