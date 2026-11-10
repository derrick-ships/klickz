import { test, expect } from "@playwright/test";
test("partial diagnostic fixtures expose missing evidence and cannot silently dispatch a paid fix", async ({
  page,
}) => {
  const paid: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/generate")) paid.push(r.url());
  });
  await page.goto("/?mode=analyze");
  await page.getByLabel("Video title", {exact:true}).waitFor();
  await page.getByLabel("Upload thumbnail references").setInputFiles("public/brand/signal.webp");
  await expect(page.getByRole("region", {name:"Thumbnail review studio"})).toBeVisible();
  await page.evaluate(async () => {
    const req = indexedDB.open("derrick-thumbnail-studio");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const imagePath = await new Promise<string>((resolve,reject)=>{const tx=db.transaction("creations","readonly"),read=tx.objectStore("creations").getAll();read.onsuccess=()=>resolve(read.result[0]?.image_path);read.onerror=()=>reject(read.error);});
    if(!imagePath)throw new Error("Upload fixture must be saved before injecting analysis");
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("creations", "readwrite");
      tx.objectStore("creations").put({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Fixture: diagnostic test",
        prompt: "A test-only thumbnail, never a real provider assessment",
        mode: "generate",
        style: "Fixture",
        persona_id: null,
        parent_id: null,
        image_path: imagePath,
        favorite: false,
        status: "ready",
        created_at: new Date().toISOString(),
        score: {
          source: "jev",
          version: 3,
          overall: null,
          partial: true,
          title: "Fixture: diagnostic test",
          priority: "clarity",
          created_at: new Date().toISOString(),
          note: "Explicit UI fixture. No provider was called.",
          fixBlocked: true,
          warnings: ["Fixture: no factual video brief."],
          dimensions: Object.fromEntries(
            ["virality", "clarity", "idea", "curiosity", "emotion"].map((p) => [
              p,
              {
                score: ["idea", "curiosity"].includes(p) ? null : 65,
                confidence: 0.5,
                observation: "A fixture observation.",
                strength: "Fixture strength.",
                weakness: "Fixture limitation.",
                fix: "Fixture edit suggestion.",
                ...(["idea", "curiosity"].includes(p)
                  ? { missingReason: "A factual video brief is missing." }
                  : {}),
              },
            ]),
          ),
        },
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  });
  await page.reload();
  await page
    .locator(".history-item")
    .filter({ hasText: "Fixture: diagnostic test" })
    .click();
  await expect(page.locator(".score-header")).toContainText("Partial");
  await expect(page.getByText("Not assessed", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Fix what's holding it back", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Fix what's holding it back", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  expect(paid).toHaveLength(0);
  // Also retain server-side blocked-plan coverage with an otherwise reviewable UI fixture.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("derrick-thumbnail-studio"); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction("creations", "readwrite"), store = tx.objectStore("creations"), read = store.get("11111111-1111-4111-8111-111111111111"); read.onsuccess = () => store.put({...read.result, score: {...read.result.score, fixBlocked: false}}); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); });
  });
  await page.reload();
  await page.locator(".history-item").filter({ hasText: "Fixture: diagnostic test" }).click();
  await page.route("**/api/fix-plan", (r) =>
    r.fulfill({
      json: {
        kind: "blocked",
        reason: "Add factual context and image-specific critique first.",
      },
    }),
  );
  await page
    .getByRole("link", { name: "Adjust fix first", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review one-click fix" }),
  ).toBeVisible();
  await page
    .getByLabel("Required objects", { exact: true })
    .fill("the original subject");
  await page
    .getByRole("button", { name: "Preview fixes · no API charge" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Add factual context and image-specific critique first."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate fix with API credits" }),
  ).toHaveCount(0);
  expect(paid).toHaveLength(0);
  await page.screenshot({
    path: "evidence/openpikzels-fix-plan-blocked.png",
    fullPage: true,
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `evidence/clarify-fix-plan-${width}.png`, fullPage: true });
  }
  await page.unroute("**/api/fix-plan");
  await page.route("**/api/fix-plan", (r) => r.fulfill({ json: {
    kind: "ready", token: "explicit-ui-fixture-never-apply", notice: "Fixture: generating one image uses provider credits.",
    plan: { title: "Fixture: diagnostic test", videoBrief: "Explicit UI fixture, no real provider assessment.", settings: { model: "flare", quality: "low" }, operations: [{ id: "fixture-issue", pillar: "clarity", instruction: "Fixture: make the subject easier to read.", tradeoff: "Fixture: retain all required objects." }] },
  } }));
  await page.getByRole("button", { name: "Preview fixes · no API charge" }).click();
  const apply = page.getByRole("button", { name: "Generate fix with API credits" });
  await expect(apply).toBeVisible();
  expect(paid).toHaveLength(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await apply.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `evidence/clarify-ready-fix-${width}.png` });
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByLabel("YouTube video link (optional)"),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Add a detailed image review/ }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "evidence/openpikzels-partial-diagnostic-mobile.png",
    fullPage: true,
  });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `evidence/clarify-analysis-${width}.png`, fullPage: true });
  }

});
