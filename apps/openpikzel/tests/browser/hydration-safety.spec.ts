import { test, expect } from "@playwright/test";

test("workspace input stays blocked until hydration and retains work afterwards", async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const configRequested = new Promise<void>(resolve => { requested = resolve; });
  await page.route("**/api/config", async route => {
    requested();
    await held;
    await route.continue();
  });
  await page.goto("/?mode=generate");
  await configRequested;
  const prompt = page.getByLabel("Describe your thumbnail", { exact: true });
  const upload = page.getByLabel("Upload thumbnail references");
  await expect(prompt).toBeDisabled();
  await expect(upload).toBeDisabled();
  await expect(page.getByRole("button", { name: /checking your workspace/i })).toBeDisabled();
  await page.getByRole("tab", { name: /score/i }).click();
  release();
  await expect(page.getByLabel("Loading creative chat")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /score/i })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /create/i }).click();
  await expect(prompt).toBeEnabled();
  await expect(upload).toBeEnabled();
  await prompt.fill("A surviving workspace draft");
  await page.reload();
  await expect(page.getByLabel("Loading creative chat")).toHaveCount(0);
  await expect(prompt).toHaveValue("A surviving workspace draft");
});

test("failed configuration releases local drafts after hydration", async ({ page }) => {
  await page.route("**/api/config", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/?mode=generate");
  await expect(page.getByRole("alert").filter({ hasText: "Connection settings" })).toContainText("Local drafts remain available");
  await expect(page.getByLabel("Describe your thumbnail", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Upload thumbnail references")).toBeEnabled();
});
