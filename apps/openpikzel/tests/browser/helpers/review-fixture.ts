import { expect, type Page } from "@playwright/test";

export async function reviewFixture(page: Page, scored = true) {
  await page.goto("/?mode=analyze");
  await page.getByLabel("Video title", { exact: true }).fill("Fixture: I rebuilt my studio in seven days");
  await page.getByLabel("Upload thumbnail references").setInputFiles("public/brand/signal.webp");
  await expect(page.getByRole("region", { name: "Thumbnail review studio" })).toBeVisible();
  if (scored) {
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("derrick-thumbnail-studio", 1);
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction("creations", "readwrite"), store = tx.objectStore("creations"), rows = store.getAll();
          rows.onsuccess = () => {
            const item = rows.result.find(c => c.title.startsWith("Fixture:"));
            store.put({ ...item, score: {
              source: "jev", version: 3, overall: null, partial: true,
              title: item.title, priority: "clarity", created_at: new Date().toISOString(),
              note: "Explicit UI fixture. No provider was called.", warnings: [],
              dimensions: Object.fromEntries(["virality", "clarity", "idea", "curiosity", "emotion"].map(p => [p, {
                score: ["idea", "curiosity"].includes(p) ? null : 65, confidence: .5,
                observation: "Fixture: one subject leads the composition.", strength: "Fixture: a clear red focal point.",
                weakness: "Fixture: the video context is incomplete.", fix: "Fixture: add the actual video summary before an edit.",
                ...(["idea", "curiosity"].includes(p) ? { missingReason: "The actual title and video summary are needed." } : {}),
              }])),
            } });
          };
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
        };
      });
    });
  }
  await page.reload();
  const openNavigation = page.getByRole("button", { name: "Open sidebar", exact: true });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.locator(".history-item").filter({ hasText: "Fixture:" }).click();
}

