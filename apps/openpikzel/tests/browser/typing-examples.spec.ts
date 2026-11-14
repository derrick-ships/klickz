import { test, expect } from "@playwright/test";

// DELIGHT.md exception 3: living empty state on the Create prompt.
test("an empty first-time prompt types examples, and one tap fills the box", async ({ page }) => {
  await page.goto("/studio?mode=generate");
  const examples = page.getByTestId("typing-examples");
  await expect(examples).toBeVisible();
  await expect(examples.locator(".typing-examples-text")).toHaveAttribute("aria-hidden", "true");
  await expect.poll(async () => (await examples.locator(".typing-examples-text").textContent())?.length ?? 0).toBeGreaterThan(10);
  const prompt = page.getByLabel("Describe your thumbnail", { exact: true });
  await expect(prompt).toHaveAttribute("placeholder", /Who or what is the focus/);
  await page.getByRole("button", { name: "Use this example", exact: true }).click();
  await expect(prompt).toHaveValue(/A shocked creator|Before and after|A chef|A runner/);
  await expect(prompt).toBeFocused();
  await expect(examples).toHaveCount(0);
});

test("examples stop on focus and on typing, and never show in other modes", async ({ page }) => {
  await page.goto("/studio?mode=generate");
  const examples = page.getByTestId("typing-examples");
  await expect(examples).toBeVisible();
  const prompt = page.getByLabel("Describe your thumbnail", { exact: true });
  await prompt.focus();
  await expect(examples).toHaveCount(0);
  await prompt.fill("My own idea");
  await prompt.blur();
  await expect(examples).toHaveCount(0);
  await prompt.fill("");
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await expect(examples).toHaveCount(0);
});

test("reduced motion shows one still example with no caret blink", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio?mode=generate");
  const text = page.getByTestId("typing-examples").locator(".typing-examples-text");
  await expect(text).toContainText("A shocked creator holding a tiny phone next to a giant one");
  const first = await text.textContent();
  await page.waitForTimeout(1200);
  expect(await text.textContent()).toBe(first);
  expect(await page.locator(".typing-caret").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
