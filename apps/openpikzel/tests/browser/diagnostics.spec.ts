import { test, expect } from "@playwright/test";
test("partial diagnostic fixtures expose missing evidence and cannot silently dispatch a paid fix", async ({
  page,
}) => {
  const paid: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/generate")) paid.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("heading", { name: "What will you create?" }).waitFor();
  await page.evaluate(async () => {
    const req = indexedDB.open("derrick-thumbnail-studio", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
    const blob = await (await fetch("/brand/signal.webp")).blob();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["assets", "creations"], "readwrite");
      tx.objectStore("assets").put({ id: "fixture-asset", blob });
      tx.objectStore("creations").put({
        id: "11111111-1111-4111-8111-111111111111",
        title: "Fixture: diagnostic test",
        prompt: "A test-only thumbnail, never a real provider assessment",
        mode: "generate",
        style: "Fixture",
        persona_id: null,
        parent_id: null,
        image_path: "fixture-asset",
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
      tx.onerror = reject;
    });
  });
  await page.reload();
  await page
    .locator(".history-item")
    .filter({ hasText: "Fixture: diagnostic test" })
    .click();
  await expect(page.locator(".score-header")).toContainText("Partial");
  await expect(page.getByText("Not assessed", { exact: true })).toHaveCount(2);
  await page.route("**/api/fix-plan", (r) =>
    r.fulfill({
      json: {
        kind: "blocked",
        reason: "Add factual context and image-specific critique first.",
      },
    }),
  );
  await page
    .getByRole("button", { name: "One-click fix", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review one-click fix" }),
  ).toBeVisible();
  await page
    .getByLabel("Required objects", { exact: true })
    .fill("the original subject");
  await page
    .getByRole("button", { name: "Prepare fix plan · no API charge" })
    .click();
  await expect(
    page.getByText("Add factual context and image-specific critique first."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply one fix with my API" }),
  ).toHaveCount(0);
  expect(paid).toHaveLength(0);
  await page.screenshot({
    path: "evidence/openpikzels-fix-plan-blocked.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByLabel("What actually happens in the video?"),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Add image-specific vision critique/ }),
  ).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "evidence/openpikzels-partial-diagnostic-mobile.png",
    fullPage: true,
  });
});
