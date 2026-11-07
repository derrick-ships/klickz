import { test, expect } from "@playwright/test";
test("brand scenes load original artwork and stream motion only after explicit play", async ({
  page,
}) => {
  const videos: string[] = [];
  page.on("request", (r) => {
    if (/\/brand\/.*\.(webm|mp4)/.test(r.url())) videos.push(r.url());
  });
  await page.goto("/?mode=generate");
  const scene = page.locator('[data-brand-scene="signal"]');
  await expect(scene).toBeVisible();
  await expect(scene.locator("img")).toHaveJSProperty("naturalWidth", 1344);
  expect(videos).toHaveLength(0);
  const player = scene.locator("video");
  expect(await player.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(
    true,
  );
  await scene.getByRole("button", { name: "Play Signal brand motion" }).click();
  await expect(
    scene.getByRole("button", { name: "Pause Signal brand motion" }),
  ).toBeVisible();
  await expect
    .poll(() => player.evaluate((v) => (v as HTMLVideoElement).paused))
    .toBe(false);
  expect(videos.length).toBeGreaterThan(0);
  await expect
    .poll(() => player.evaluate((v) => (v as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0.05);
  await page.getByLabel("Prompt", { exact: true }).focus();
  await expect(
    scene.getByRole("button", { name: "Play Signal brand motion" }),
  ).toBeVisible();
  expect(await player.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(
    true,
  );
});
test("onboarding poster remains still with reduced motion and mobile controls stay usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  const videos: string[] = [];
  page.on("request", (r) => {
    if (/\/brand\/.*\.(webm|mp4)/.test(r.url())) videos.push(r.url());
  });
  await page.goto("/connect");
  const scene = page.locator('[data-brand-scene="aperture"]');
  await expect(scene).toBeVisible();
  await expect(scene.locator("img")).toHaveJSProperty("naturalWidth", 1344);
  expect(videos).toHaveLength(0);
  expect(
    (await scene.getByRole("button").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "evidence/openpikzels-brand-onboarding-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "evidence/openpikzels-brand-onboarding-desktop.png",
    fullPage: true,
  });
});
