import { test, expect } from "@playwright/test";
import { openMoreOptions } from "./helpers/more-options";
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
  await page.locator('details.more-options:not(.request-readiness):not([open]) > summary').first().click().catch(()=>{});
  await page.getByLabel("Quality", { exact: true }).selectOption("xhigh");
  await page.getByLabel("Planning effort", { exact: true }).selectOption("high");
  await page.getByLabel("Images per request", { exact: true }).selectOption("4");
  await page.getByRole("button",{name:/^Rendering model:/}).click();await page.getByRole("button",{name:"Sunburst 2.6",exact:true}).click();
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
  await openMoreOptions(page);
  await expect(page.getByRole("button",{name:/^Rendering model:/})).toHaveText("Sunburst 2.6");
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
test("AI resize asks local visitors to sign in and preserves the original",async({page})=>{
  let paid=0;await page.route("**/api/generate",r=>{paid++;return r.abort();});
  await page.goto("/?mode=analyze");await expect(page.getByLabel("Upload thumbnail references")).toBeEnabled();await page.getByLabel("Upload thumbnail references").setInputFiles(await photo());
  await expect(page.getByRole("img",{name:"Selected thumbnail"})).toBeVisible();
  await expect(page.locator(".resize-note")).toContainText("Provider usage charges apply");
  await page.getByRole("button",{name:"AI resize to short-form",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();expect(paid).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"AI resize to short-form",exact:true})).toBeVisible();
});
test("all five modes and truthful disabled-AI boundaries are present", async ({
  page,
  request,
}) => {
  await page.goto("/?mode=generate");
  for (const name of ["Create", "Score", "Edit", "Remix", "Titles"])
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  await page
    .getByLabel("Describe your thumbnail", { exact: true })
    .fill("A clear and specific video concept");
  await page.getByRole("button", { name: "Sign in to generate", exact: true }).click();
  await expect(
    page.getByRole("dialog"),
  ).toContainText("Sign in");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("tab", { name: "Score", exact: true }).click();
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
        page.locator(".format-chip"),
        page.getByRole("tab", { name: "Create", exact: true }),
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
