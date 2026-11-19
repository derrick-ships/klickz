import { it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { styleLibrary, styleCategories } from "../src/lib/style-library";

it("ships the image-backed Style OS thumbnails and existing house style", () => {
  expect(styleLibrary).toHaveLength(93);
  expect(styleCategories).toEqual(["documentary", "review", "entertainment", "education", "illustration"]);
  const ids = styleLibrary.map((s) => s.id);
  for (const id of ["house-political-news", "captured", "dramatic", "shocking-truth", "comparison", "review", "split-background", "chiaroscuro", "confused", "crime-scene", "podcast", "podcast-02", "blueprint", "listicle", "estatement", "estatement-02", "whiteboard"]) expect(ids).toContain(id);
  expect(ids).toContain("review-02");
  expect(ids).not.toContain("crayon");
  for (const style of styleLibrary) {
    expect(styleCategories).toContain(style.category);
    expect(style.description.length).toBeGreaterThan(0);
    expect(style.description).not.toMatch(/Nichos:|Referencia visual:/);
    expect(["composition", "look"]).toContain(style.mode);
    expect(style.composition.trim().length).toBeGreaterThan(0);
    expect(style.composition).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(["required", "none"]).toContain(style.text);
    expect(style.images.length).toBeGreaterThan(0);
    for (const image of style.images) expect(existsSync(join("public", image)), image).toBe(true);
  }
  expect(new Set(ids).size).toBe(93);
});
