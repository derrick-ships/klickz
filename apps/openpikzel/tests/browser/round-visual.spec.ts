import { test, expect } from "@playwright/test";
import { reviewFixture } from "./helpers/review-fixture";

test("the score sits on the thumbnail, batch goes to 16x, and the style library is browsable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await reviewFixture(page, true);
  const badge = page.locator(".review-canvas .score-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("aria-label", /Score \d+ out of 100|Partial score/);
  await page.locator(".review-canvas").screenshot({ path: "evidence/round-score-badge.png" });

  await page.goto("/studio?mode=generate");
  const batch = page.getByLabel("Images per request");
  await expect(batch.locator("option")).toHaveText(["1×", "2×", "4×", "8×", "16×"]);
  await page.screenshot({ path: "evidence/round-composer.png" });

  const show = page.getByRole("button", { name: /Show prompt and settings/ });
  if (await show.isVisible().catch(() => false)) await show.click();
  // The style library lives in the Style dialog (16 Nov: removed from More options).
  await page.getByRole("button", { name: "Style", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Library", exact: true }).click();
  const chip = page.getByRole("dialog").getByRole("button", { name: /Chiaroscuro/ }).first();
  await chip.click();
  await expect(page.locator(".selection-chip", { hasText: "Chiaroscuro" })).toBeVisible();
});
