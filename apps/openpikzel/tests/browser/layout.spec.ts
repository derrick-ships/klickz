import { test, expect } from "@playwright/test";
import { openMoreOptions } from "./helpers/more-options";
// Persona photos here are solid-colour fixtures: block the face model so the check reports "unavailable" (accepted).
test.beforeEach(async({page})=>{await page.route(/cdn\.jsdelivr\.net|mediapipe-models/,r=>r.abort());});
import sharp from "sharp";

test("compact navigation protects the workbench and returns keyboard focus", async ({ page }) => {
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?mode=generate");
    const sidebar = page.locator("aside.sidebar");
    await expect(sidebar).toHaveAttribute("inert", "");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to studio" })).toBeFocused();
    await page.keyboard.press("Tab");
    const open = page.getByRole("button", { name: "Open sidebar", exact: true });
    await expect(open).toBeFocused();
    await open.click();
    const close = page.getByRole("button", { name: "Close sidebar", exact: true });
    await expect(close).toBeFocused();
    await expect(page.locator(".workspace-main")).toHaveAttribute("inert", "");
    const last = sidebar.locator('a[href],button:not(:disabled),select:not(:disabled)').last();
    await last.focus();
    await page.keyboard.press("Tab");
    await expect(sidebar.getByRole("link", { name: "OpenPikzels" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
    await open.click();
    await close.click();
    await expect(open).toBeFocused();
    for (const name of ["New chat", "Show favorites", "My creations"]) {
      await open.click();
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.locator("#studio-content")).toBeFocused();
      await expect(sidebar).toHaveAttribute("inert", "");
    }
    await page.screenshot({ path: `evidence/layout-workbench-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?mode=generate");
  await expect(page.locator("aside.sidebar")).not.toHaveAttribute("inert", "");
});

test("composer groups, small-screen settings and long content reflow deliberately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?mode=generate");
    const subject = page.getByRole("group", { name: "Subject and style" });
    const references = page.getByRole("group", { name: "Image references" });
    for (const group of [subject, references]) {
      const midpoints = await group.getByRole("button").evaluateAll(items => items.map(el => {
        const box = el.getBoundingClientRect();
        return box.top + box.height / 2;
      }));
      expect(Math.max(...midpoints) - Math.min(...midpoints)).toBeLessThan(2);
    }
    if (width <= 760) expect((await references.boundingBox())!.y).toBeGreaterThan((await subject.boundingBox())!.y);
    await openMoreOptions(page);const model = page.getByLabel("Rendering model");
    await model.click();await page.getByRole("button",{name:"Gemini Pro",exact:true}).click();
    await page.getByLabel("Describe your thumbnail", { exact: true }).fill("Una composición cinematográfica con un personaje consistente y referencias bien definidas. ".repeat(30));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Persona", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Your personas" })).toBeVisible();
    await page.screenshot({ path: `evidence/layout-personas-${width}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.getByLabel("Describe your thumbnail", { exact: true }).fill("");
    await page.getByLabel("Describe your thumbnail", { exact: true }).blur();
    await page.screenshot({ path: `evidence/layout-editor-${width}.png`, fullPage: true });
  }
  // 320 CSS px also covers reflow at 200% for a 640px browser window.
  await expect(page.getByLabel("Upload thumbnail references")).toHaveAttribute("tabindex", "-1");
});


test("long persona names remain readable in dialogs and bounded in the composer", async ({ page }) => {
  const name = "Personaje editorial de referencia con identidad consistente y dirección cinematográfica".slice(0, 80);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/?mode=generate");
  await page.getByRole("button", { name: "Persona", exact: true }).click();
  await page.getByRole("button", { name: "Create persona", exact: true }).click();
  await page.getByRole("button",{name:"Skip Tutorial",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Profile reference photos").setInputFiles(await Promise.all(["#df1c2c","#2d599a","#56a58b"].map(async(color,i)=>({name:"layout-"+i+".png",mimeType:"image/png",buffer:await sharp({create:{width:64,height:64,channels:3,background:color}}).png().toBuffer()}))));
  await page.getByLabel("I have permission to use this person’s face.").check();
  await page.getByRole("button", { name: "Create persona", exact: true }).click();
  await expect(page.getByRole("button", { name: "Change persona: "+name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await page.locator(".selection-name").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.screenshot({ path: "evidence/layout-long-persona-selected-320.png", fullPage: true });
  await page.getByRole("button",{name:"Remove persona: "+name,exact:true}).focus();await page.keyboard.press("Enter");await expect(page.getByRole("button",{name:"Persona",exact:true})).toBeFocused();await expect(page.getByRole("button",{name:"Remove persona: "+name,exact:true})).toHaveCount(0);
});
