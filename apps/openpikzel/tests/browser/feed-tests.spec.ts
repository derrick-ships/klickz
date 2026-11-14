import { test, expect, type Page } from "@playwright/test";
import { reviewFixture } from "./helpers/review-fixture";
async function settleResponsiveNavigation(page:Page,width:number,height:number){
 await page.setViewportSize({width,height});
 if(width<=1024){
  await expect(page.locator('aside.sidebar')).toBeHidden();
  await expect(page.locator('.workspace-main')).not.toHaveAttribute('inert','');
  await expect(page.locator('.workspace-main')).toHaveCSS('filter','none');
 }else await expect(page.locator('aside.sidebar')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test("feed preview switches dark/light, squints, and shows pixel checks without leaving the browser", async ({ page }) => {
  const outbound: string[] = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (u.hostname !== "127.0.0.1" && !/^(blob|data):/.test(r.url())) outbound.push(r.url()); });
  await reviewFixture(page, false);
  await page.getByRole("button", { name: "Toggle phone feed preview", exact: true }).click();
  const preview = page.locator(".youtube-preview");
  await expect(preview).toHaveAttribute("data-theme", "dark");
  await expect(preview).toHaveCSS("background-color", "rgb(15, 15, 15)");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(preview).toHaveAttribute("data-theme", "light");
  await expect(preview).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Squint", exact: true }).click();
  await expect(preview).toHaveAttribute("data-squint", "true");
  await expect.poll(() => preview.locator(".youtube-preview-thumbnail").evaluate((el) => getComputedStyle(el).filter)).toBe("blur(3px)");
  const checks = page.getByRole("list", { name: "Feed checks" });
  await expect(checks.getByRole("listitem")).toHaveCount(3);
  await expect(checks).toContainText("dark feed");
  await expect(checks).toContainText("light feed");
  await expect(checks).toContainText("grayscale");
  for (const width of [1440, 390, 320]) {
    await settleResponsiveNavigation(page, width, 900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `evidence/feed-tests-${width}.png`, fullPage: true });
  }
  expect(outbound).toEqual([]);
});

test("reduced motion switches feed tests instantly", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await reviewFixture(page, false);
  await page.getByRole("button", { name: "Toggle phone feed preview", exact: true }).click();
  const preview = page.locator(".youtube-preview");
  expect(await preview.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(preview).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
