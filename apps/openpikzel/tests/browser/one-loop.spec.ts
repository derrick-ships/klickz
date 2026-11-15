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

test("there is no creative chat: the only path is describe, create, score", async ({ page }) => {
  await page.goto("/studio?mode=generate");
  await expect(page.getByLabel("Describe your thumbnail", { exact: true })).toBeVisible();
  await expect(page.getByText("Creative chat", { exact: true })).toHaveCount(0);
  await expect(page.locator(".creative-conversation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Improve my description", exact: true })).toHaveCount(0);
});
