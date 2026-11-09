import { test, expect } from "@playwright/test";
import sharp from "sharp";
const photo = async () => ({
  name: "reference.png",
  mimeType: "image/png",
  buffer: await sharp({
    create: { width: 800, height: 450, channels: 3, background: "#ff3b43" },
  })
    .png()
    .toBuffer(),
});
test("draft, quality, batch and persona collections survive reloads", async ({
  page,
}) => {
  await page.goto("/?mode=generate");
  await expect(
    page.getByRole("heading", { name: "What will you create?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generation settings", exact: true }).click();
  await page.getByLabel("Quality", { exact: true }).selectOption("xhigh");
  await page.getByLabel("Planning effort", { exact: true }).selectOption("high");
  await page.getByLabel("Images per request", { exact: true }).selectOption("4");
  await page.getByRole("button",{name:"Rendering model",exact:true}).click();await page.getByRole("button",{name:"Sunburst 2.6",exact:true}).click();
  await page.getByLabel("Format", { exact: true }).selectOption("short");
  await page
    .getByLabel("Describe your thumbnail", { exact: true })
    .fill("I spent 30 days offline and got my focus back");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Concept saved." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle phone feed preview" })).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: /I spent 30 days offline/ })
    .first()
    .click();
  await expect(page.getByLabel("Images per request")).toHaveValue("1");
  await expect(page.getByRole("button",{name:"Rendering model",exact:true})).toHaveText("Sunburst 2.6");
  await expect(page.getByLabel("Format", { exact: true })).toHaveValue("short");
  await page.getByRole("button", { name: "Persona", exact: true }).click();
  await page
    .getByRole("button", { name: "Create persona", exact: true })
    .click();
  await page.getByRole("button",{name:"Skip Tutorial",exact:true}).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Derrick");
  await page
    .getByLabel("Profile reference photos")
    .setInputFiles(await Promise.all(["#ff3b43","#485cdb","#52b78b"].map(async(color,i)=>({name:"persona-"+i+".png",mimeType:"image/png",buffer:await sharp({create:{width:800,height:450,channels:3,background:color}}).png().toBuffer()}))));
  await page.getByLabel("I have permission to use these photos and this likeness.").check();
  await page
    .getByRole("button", { name: "Create persona", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Change persona: Derrick", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Persona", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Derrick reference" }).first(),
  ).toBeVisible();
});
test("image upload and one-click vertical resize produce a real 720x1280 PNG locally", async ({
  page,
}) => {
  await page.goto("/?mode=analyze");
  await page
    .getByLabel("Upload thumbnail references")
    .setInputFiles(await photo());
  await expect(
    page.getByRole("img", { name: "Selected thumbnail" }),
  ).toBeVisible();
  await page
    .getByLabel("Video title", { exact: true })
    .fill("A real video title");
  await page
    .getByRole("button", { name: "Resize to short-form", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ready for another format." }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const meta = await sharp(path!).metadata();
  expect([meta.width, meta.height, meta.format]).toEqual([720, 1280, "png"]);
  await page.reload();

  await expect(
    page.getByRole("button", { name: "Resize to long-form", exact: true }),
  ).toBeVisible();
});
test("all five modes and truthful disabled-AI boundaries are present", async ({
  page,
  request,
}) => {
  await page.goto("/?mode=generate");
  for (const name of ["Recreate", "Prompt", "Analyze", "Edit", "Title"])
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  await page
    .getByLabel("Describe your thumbnail", { exact: true })
    .fill("A clear and specific video concept");
  await page.getByRole("button", { name: "Sign in to generate", exact: true }).click();
  await expect(
    page.getByRole("dialog"),
  ).toContainText("Sign in");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("tab", { name: "Analyze", exact: true }).click();
  for (const name of ["Virality", "Clarity", "Idea", "Curiosity", "Emotion"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  const r = await request.post("/api/reference", {
    data: { url: "https://127.0.0.1/secret" },
  });
  expect(r.status()).toBe(400);
  for (const route of ["generate", "analyze", "resize", "persona/prepare"]) {
    const result = await request.post("/api/" + route, { data: {} });
    expect(result.status()).toBe(503);
  }
  const config = await (await request.get("/api/config")).json();
  expect(config.ai).toBe(false);
  expect(JSON.stringify(config)).not.toContain("sk-");
});
test("desktop and mobile editor fit their viewport", async ({ page }) => {
  for (const [width, height, name] of [
    [1440, 1000, "desktop"],
    [390, 844, "mobile"],
    [1280, 800, "laptop"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/?mode=generate");
    await expect(
      page.getByRole("button", { name: "Sign in to generate", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      for (const control of [
        page.getByLabel("Rendering model"),
        page.getByLabel("Format", { exact: true }),
        page.getByRole("tab", { name: "Prompt", exact: true }),
      ])
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(
          44,
        );
    }
    await page.screenshot({
      path: `evidence/openpikzel-${name}.png`,
      fullPage: true,
    });
  }
});
