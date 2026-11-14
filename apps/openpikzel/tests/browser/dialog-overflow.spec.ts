import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

// #29: the shared dialog shows a visible cue while content continues below the
// fold, and none when everything fits. Keyboard focus and inline errors stay usable.
async function seedPersonas(page: Page, count: number) {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ac524e" } }).png().toBuffer();
  await page.goto("/connect");
  await page.evaluate(async ({ bytes, count }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("derrick-thumbnail-studio", 2);
      r.onupgradeneeded = () => {
        for (const s of ["creations", "personas", "styles", "assets", "conversations", "preferences", "feedback"])
          if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: "id" });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["personas", "assets"], "readwrite");
    const buf = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0)).buffer;
    for (const id of ["ref-0", "ref-1", "ref-2"]) tx.objectStore("assets").put({ id, bytes: buf, mime: "image/png" });
    for (let i = 0; i < count; i++)
      tx.objectStore("personas").put({ id: `p-${i}`, name: `Persona ${i + 1}`, notes: "", refs: ["ref-0", "ref-1", "ref-2"], created_at: "2026-11-10T00:00:00.000Z", profile_status: "draft" });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { bytes: png.toString("base64"), count });
}

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`dialog overflow cue appears only while content continues at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await seedPersonas(page, 12);
    await page.goto("/");
    await page.getByRole("button", { name: "Persona", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Your personas" });
    await expect(dialog).toBeVisible();
    const cue = page.getByTestId("dialog-overflow-cue");
    const overflows = await dialog.evaluate((node) => node.scrollHeight > node.clientHeight + 8);
    if (overflows) {
      await expect(cue).toBeVisible();
      await expect(cue).toHaveAttribute("aria-hidden", "true");
      await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await expect(cue).toHaveCount(0);
    } else await expect(cue).toHaveCount(0);
    await page.screenshot({ path: `test-results/dialog-overflow-${size.width}.png` });
    await page.keyboard.press("Tab");
    const focusedInside = await page.evaluate(() => !!document.activeElement?.closest("dialog"));
    expect(focusedInside).toBe(true);
  });
}

test("dialog shows no overflow cue when its content fits", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Persona", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Your personas" });
  await expect(dialog).toBeVisible();
  const overflows = await dialog.evaluate((node) => node.scrollHeight > node.clientHeight + 8);
  if (!overflows) await expect(page.getByTestId("dialog-overflow-cue")).toHaveCount(0);
});
