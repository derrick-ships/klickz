import { it, expect } from "vitest";
import sharp from "sharp";
import { youtubeJpeg } from "../src/lib/youtube-jpeg";

it("turns a large PNG into a 1280x720 JPG under 2 MB", async () => {
  // Noise compresses badly: the worst case for size.
  const raw = Buffer.alloc(1536 * 864 * 3); for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  const png = await sharp(raw, { raw: { width: 1536, height: 864, channels: 3 } }).png().toBuffer();
  const jpg = await youtubeJpeg(png);
  const meta = await sharp(jpg).metadata();
  expect(meta.format).toBe("jpeg");
  expect([meta.width, meta.height]).toEqual([1280, 720]);
  expect(jpg.length).toBeLessThan(2 * 1024 * 1024);
});
