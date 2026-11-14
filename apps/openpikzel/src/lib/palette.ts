import sharp from "sharp";

// Deterministic colour palette from real thumbnail pixels: no AI call, no cost.
// Pixels are quantized to a 4-bit-per-channel grid, near-grey/near-black pixels are
// down-weighted so the vivid accents a thumbnail is built on are not drowned by
// shadows, and similar buckets are merged. Returns up to `limit` hex colours,
// most dominant first, plus each colour's share of the analysed pixels.
export type PaletteColor = { hex: string; share: number };

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export async function extractPalette(images: Buffer[], limit = 6): Promise<PaletteColor[]> {
  const buckets = new Map<number, { r: number; g: number; b: number; weight: number; count: number }>();
  let total = 0;
  for (const image of images) {
    const { data, info } = await sharp(image, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(96, 96, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      // Neutral and very dark pixels still count, at a lower weight.
      const weight = 0.35 + saturation * (max / 255) * 1.65;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0, count: 0 };
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.weight += weight; bucket.count += 1;
      buckets.set(key, bucket);
      total += 1;
    }
  }
  const ranked = [...buckets.values()]
    .map((b) => ({ rgb: [b.r / b.count, b.g / b.count, b.b / b.count] as [number, number, number], weight: b.weight, count: b.count }))
    .sort((a, b) => b.weight - a.weight);
  const chosen: { rgb: [number, number, number]; weight: number; count: number }[] = [];
  for (const candidate of ranked) {
    const near = chosen.find((c) => distance(c.rgb, candidate.rgb) < 48);
    if (near) { near.weight += candidate.weight; near.count += candidate.count; continue; }
    if (chosen.length < limit) chosen.push({ ...candidate });
  }
  return chosen
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({ hex: hex(...c.rgb), share: total ? Math.round((c.count / total) * 1000) / 1000 : 0 }));
}
