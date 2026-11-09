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
    await expect(page.getByRole("alert").filter({ hasText: "at least eight characters" })).toContainText("at least eight characters");
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
  const controls = page.getByRole("button", { name: "Generation settings", exact: true });
  await controls.click();
  const advanced = page.locator(".advanced-controls");
  expect(await advanced.evaluate(el => getComputedStyle(el).animationName)).toBe("control-unfold");
  await controls.click();
  await expect(advanced).toHaveCount(0);
  await controls.press("Enter");
  expect(await advanced.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
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
