import { test, expect } from "@playwright/test";
test("mode tabs support roving keyboard navigation and visible focus", async ({ page }) => {
  await page.goto("/?mode=generate");
  await expect(page.getByLabel("Loading creative chat")).toHaveCount(0);
  const prompt = page.getByRole("tab", { name: "Create", exact: true });
  await expect(prompt).toHaveAttribute("aria-selected", "true");
  await expect(prompt).toBeEnabled();
  await prompt.focus();
  await page.keyboard.press("ArrowRight");
  const analyze = page.getByRole("tab", { name: "Score", exact: true });
  await expect(analyze).toBeFocused();
  await expect(analyze).toHaveAttribute("aria-selected", "true");
  await expect(prompt).toHaveAttribute("tabindex", "-1");
  expect(await analyze.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("ArrowRight");
  await expect(prompt).toBeFocused();
  await page.keyboard.press("End");
  await expect(analyze).toBeFocused();
  await page.keyboard.press("Home");
  await expect(prompt).toBeFocused();
});
test("a mode tab chosen during load survives hydration", async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(r => { release = r; });
  await page.route("**/api/config", async route => {
    await hold;
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.goto("/?mode=generate");
  const analyze = page.getByRole("tab", { name: "Score", exact: true });
  await expect(analyze).toBeVisible();
  await expect(analyze).toBeEnabled();
  await analyze.click();
  await expect(analyze).toHaveAttribute("aria-selected", "true");
  release();
  await expect(page.getByLabel("Loading creative chat")).toHaveCount(0);
  await expect(analyze).toHaveAttribute("aria-selected", "true");
});
test("refined studio fits narrow, tablet and wide layouts with keyboard dialogs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?mode=generate");
    await page.getByLabel("Describe your thumbnail", { exact: true }).fill("A deliberately long visual direction with readable wording, a consistent subject, practical lighting and a clear focal point. ".repeat(10));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const tabs = page.getByRole("tablist");
    for (const tab of await tabs.getByRole("tab").all()) {
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    await page.getByRole("button", { name: "Persona", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.getByRole("dialog").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    if (width === 390 || width === 1440) {
      await page.getByLabel("Describe your thumbnail", { exact: true }).fill("");
      await page.getByLabel("Describe your thumbnail", { exact: true }).blur();
      await page.screenshot({ path: `evidence/openpikzels-polished-${width}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
