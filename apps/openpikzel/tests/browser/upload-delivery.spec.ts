import { test, expect } from "@playwright/test";
import { revealStudio } from "./helpers/image-reveal";

test("upload after a settled delivery keeps the generated result and never reveals the reference", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    (window as any).__referenceReveals = [];
    document.addEventListener("animationstart", event => {
      const image = event.target;
      if (image instanceof HTMLImageElement && image.src.includes("/references/") && event.animationName.startsWith("delivery-reveal")) (window as any).__referenceReveals.push(image.src);
    }, true);
  });
  const studio = await revealStudio(page);
  await studio.generate(1);
  const delivered = page.locator(".delivery-result img");
  await expect(delivered).toHaveAttribute("alt", "Fixture result 1");
  await expect(delivered).not.toHaveClass(/delivery-reveal/);
  const src = await delivered.getAttribute("src");
  await page.getByRole("button", { name: "Show prompt and settings", exact: true }).click();
  await page.getByRole("tab", { name: "Score", exact: true }).click();
  await page.getByLabel("Upload thumbnail references").setInputFiles("public/brand/signal.webp");
  await expect(page.locator(".review-summary")).toContainText("Uploaded thumbnail");
  await expect(delivered).toHaveAttribute("src", src!);
  await expect(delivered).toHaveAttribute("alt", "Fixture result 1");
  await expect(page.locator(".delivery-result img[src*=references]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__referenceReveals)).toEqual([]);
  await page.getByRole("button", { name: "My creations", exact: true }).click();
  await expect(page.locator(".creation-card").filter({ hasText: "Uploaded thumbnail" })).toBeVisible();
});


test("an upload before generation stays static and does not become a delivery", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const studio = await revealStudio(page);
  await studio.open();
  await page.getByRole("button", { name: "Show prompt and settings", exact: true }).click();
  await page.getByRole("tab", { name: "Score", exact: true }).click();
  await page.getByLabel("Upload thumbnail references").setInputFiles("public/brand/signal.webp");
  await expect(page.locator(".review-summary")).toContainText("Uploaded thumbnail");
  await expect(page.locator(".delivery-result img")).toHaveCount(0);
  await expect(page.locator(".review-canvas img")).not.toHaveClass(/image-reveal/);
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await studio.generate(1);
  await expect(page.locator(".delivery-result img")).toHaveAttribute("alt", "Fixture result 1");
});
