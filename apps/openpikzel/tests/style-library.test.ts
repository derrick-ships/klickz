import { it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { styleLibrary, styleCategories } from "../src/lib/style-library";

it("ships the 16 categorised Style OS thumbnails with their images and descriptions", () => {
  expect(styleLibrary).toHaveLength(16);
  for (const style of styleLibrary) {
    expect(styleCategories).toContain(style.category);
    expect(style.description.length).toBeGreaterThan(40);
    expect(style.images.length).toBeGreaterThan(0);
    for (const image of style.images) expect(existsSync(join("public", image)), image).toBe(true);
  }
  expect(new Set(styleLibrary.map((s) => s.id)).size).toBe(16);
});
