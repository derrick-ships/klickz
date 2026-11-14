import { it, expect } from "vitest";
import sharp from "sharp";
import { extractPalette } from "../src/lib/palette";

const block = (color: string, width: number) => ({ input: { create: { width, height: 100, channels: 3 as const, background: color } }, left: 0, top: 0 });

it("finds the dominant colours of real thumbnail pixels, most dominant first", async () => {
  const thumb = await sharp({ create: { width: 300, height: 100, channels: 3, background: "#008080" } })
    .composite([{ ...block("#ff6600", 100), left: 200 }, { ...block("#ffd700", 40), left: 0 }])
    .png()
    .toBuffer();
  const palette = await extractPalette([thumb]);
  const hexes = palette.map((c) => c.hex);
  expect(hexes[0]).toBe("#008080");
  expect(hexes).toContain("#ff6600");
  expect(hexes).toContain("#ffd700");
  expect(palette.length).toBeLessThanOrEqual(6);
  for (const c of palette) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
});

it("merges near-identical shades and is deterministic", async () => {
  const a = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#cc2020" } }).png().toBuffer();
  const b = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#cf2323" } }).png().toBuffer();
  const first = await extractPalette([a, b]);
  expect(first).toHaveLength(1);
  expect(await extractPalette([a, b])).toEqual(first);
});
