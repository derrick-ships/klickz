import { test, expect } from "@playwright/test";

// OpenPikzels does one loop: Create and Score. Retired modes open Create.
test("only Create and Score are offered, and old Edit/Remix/Titles links open Create", async ({ page }) => {
  for (const mode of ["edit", "recreate", "title", "generate"]) {
    await page.goto("/studio?mode=" + mode);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(page.getByRole("tab", { name: "Create", exact: true })).toHaveAttribute("aria-selected", "true");
  }
  await page.goto("/studio?mode=analyze");
  await expect(page.getByRole("tab", { name: "Score", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("Create asks for an optional video title so the auto-score is complete", async ({ page }) => {
  await page.goto("/studio?mode=generate");
  const title = page.getByLabel(/Video title/);
  await expect(title).toBeVisible();
  await title.fill("Revisé las cuentas de la Agencia Nacional de Tierras");
  await page.getByRole("tab", { name: "Score", exact: true }).click();
  await expect(page.getByLabel("Video title", { exact: true })).toHaveValue("Revisé las cuentas de la Agencia Nacional de Tierras");
});
