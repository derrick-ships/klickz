import { test, expect } from "@playwright/test";
import { reviewFixture } from "./helpers/review-fixture";


test("review puts the real image first, with a neighboring inspector and an actual 200px preview", async ({ page }) => {
  const paid: string[] = []; page.on("request", r => { if (/\/api\/(generate|analyze)$/.test(r.url())) paid.push(r.url()); });
  await reviewFixture(page);
  const stage = page.getByRole("region", { name: "Thumbnail review studio" });
  await expect(page.getByLabel("Describe your thumbnail", { exact: true })).toBeHidden();
  await expect(stage.locator(".score-header")).toContainText("Partial");
  await expect(stage.getByText("Not assessed", { exact: true })).toHaveCount(2);
  for (const name of ["Virality score", "Clarity score", "Emotion score"])
    await expect(stage.getByRole("progressbar", { name, exact: true })).toBeVisible();
  for (const width of [320, 375, 390, 768, 1024, 1100, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await stage.scrollIntoViewIfNeeded();
    const image = await stage.locator(".review-canvas").boundingBox(), inspector = await stage.getByRole("complementary", { name: "Scoring inspector" }).boundingBox();
    // Available canvas width, not viewport width: the sidebar appears above 1024px.
    const available = (await stage.boundingBox())!.width;
    if (available >= 960) {
      expect(inspector!.x).toBeGreaterThan(image!.x + image!.width);
      expect(inspector!.width).toBeGreaterThanOrEqual(280);
    } else expect(inspector!.y).toBeGreaterThanOrEqual(image!.y + image!.height);
    const renderedImage = await stage.locator(".result-image").boundingBox();
    expect(renderedImage!.width).toBeGreaterThanOrEqual(Math.min(500, available - 32));
    if (width === 1100) expect(image!.width).toBeGreaterThan(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `evidence/review-studio-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = page.getByRole("button", { name: "Toggle phone feed preview" });
  await preview.click(); await expect(preview).toHaveAttribute("aria-pressed", "true");
  expect((await stage.locator(".result-image").boundingBox())!.width).toBe(200);
  await expect(stage.getByText("Browse · thumbnail at 200 px")).toBeVisible();
  await page.screenshot({ path: "evidence/review-studio-feed-1440.png", fullPage: true });
  await preview.click();
  await stage.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByLabel("Video title", { exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Hide prompt and settings" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Hide prompt and settings" }).click();
  await expect(page.getByLabel("Video title", { exact: true })).toBeHidden();
  await page.getByRole("tab", { name: "Prompt", exact: true }).click();
  await expect(page.getByLabel("Describe your thumbnail", { exact: true })).toBeVisible();
  expect(paid).toEqual([]);
});

test("unscored and failed previews stay useful, with reduced-motion and real refresh", async ({ page }) => {
  await reviewFixture(page, false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const stage = page.getByRole("region", { name: "Thumbnail review studio" });
  await expect(stage.getByRole("heading", { name: "Review thumbnail and title" })).toBeVisible();
  expect(await stage.locator(".result-image img").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await expect(stage.locator("figure")).toHaveAttribute("aria-busy", "false");
  await expect(stage.getByText("Loading image…", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "evidence/review-studio-unscored.png", fullPage: true });
  await stage.locator(".result-image img").dispatchEvent("error");
  await expect(stage.getByText("This preview could not load.")).toBeVisible();
  await expect(stage.locator("figcaption")).toContainText("Preview unavailable");
  await page.screenshot({ path: "evidence/review-studio-preview-error.png", fullPage: true });
  await stage.getByRole("button", { name: "Refresh preview" }).click();
  await expect(stage.locator(".result-image img")).toBeVisible();
  await expect(stage.locator("figcaption")).toContainText("1344 × 752");
  await stage.getByRole("button", { name: "Set up analysis" }).click();
  await expect(page.getByLabel("Video title", { exact: true })).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "evidence/review-studio-analysis-controls.png", fullPage: true });
});

test("topmost dialog owns Escape and keyboard presses keep a static control footprint", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/?mode=generate");
    if (width <= 1024) await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
    const personas = page.locator("aside.sidebar").getByRole("button", { name: "Personas", exact: true });
    await personas.click(); await expect(page.getByRole("dialog", { name: "Your personas" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible(); await expect(personas).toBeFocused();
    if (width <= 1024) { await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Open sidebar", exact: true })).toBeFocused(); }
    const controls = page.getByRole("button", { name: "Generation settings", exact: true }); await controls.focus();
    const before = await controls.boundingBox(); await page.keyboard.down("Space");
    expect(await controls.evaluate(el => getComputedStyle(el).transform)).toBe("none");
    expect(await controls.boundingBox()).toEqual(before); await page.keyboard.up("Space");
  }
});
