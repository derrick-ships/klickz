import { it, expect } from "vitest";
import { analyzePixels, verdicts, contrastRatio } from "../src/lib/feed-check";

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = paint(x, y); const i = (y * w + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return data;
}

it("contrast ratio matches WCAG for black and white", () => {
  expect(Math.round(contrastRatio(1, 0) * 10) / 10).toBe(21);
});

it("a near-black thumbnail blends into the dark feed but stands out on light", () => {
  const c = analyzePixels(image(40, 24, () => [18, 18, 18]), 40, 24);
  const v = Object.fromEntries(verdicts(c).map((x) => [x.id, x.pass]));
  expect(v.dark).toBe(false);
  expect(v.light).toBe(true);
  expect(v.grayscale).toBe(false);
});

it("a bright, high-contrast thumbnail with a vivid accent passes every check", () => {
  const c = analyzePixels(image(40, 24, (x) => (x < 20 ? [255, 215, 0] : [0, 128, 128])), 40, 24);
  expect(c.vivid).toBeGreaterThan(0.4);
  const v = Object.fromEntries(verdicts(c).map((x) => [x.id, x.pass]));
  expect(v).toEqual({ dark: true, light: true, grayscale: true });
});

it("red on green at equal brightness fails the grayscale check", () => {
  const c = analyzePixels(image(40, 24, (x) => (x < 20 ? [200, 60, 60] : [60, 140, 60])), 40, 24);
  expect(verdicts(c).find((v) => v.id === "grayscale")!.pass).toBe(false);
});
