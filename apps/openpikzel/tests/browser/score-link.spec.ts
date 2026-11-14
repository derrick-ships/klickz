import { test, expect } from "@playwright/test";

// QA: pasting a YouTube link in Score gets the thumbnail and the video's title in one step.
test("pasting a YouTube link in Score fetches the thumbnail and fills the title", async ({ page }) => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  let calls = 0;
  await page.route("**/api/reference", async (r) => {
    calls++;
    expect(r.request().postDataJSON().url).toBe("https://youtu.be/R1d0VZ0Hk4c");
    await r.fulfill({ status: 200, body: png, headers: { "Content-Type": "image/png", "X-Video-Title": encodeURIComponent("Abelardo destruye el mito del M-19") } });
  });
  await page.goto("/studio?mode=analyze");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const input = page.getByLabel("Reference URL", { exact: true });
  await input.focus();
  await page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement;
    const data = new DataTransfer(); data.setData("text/plain", "https://youtu.be/R1d0VZ0Hk4c");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect.poll(() => calls).toBe(1);
  await expect(page.getByLabel("Video title", { exact: true })).toHaveValue("Abelardo destruye el mito del M-19");
  await expect(page.getByRole("button", { name: "Import", exact: true })).toHaveCount(0);
});
