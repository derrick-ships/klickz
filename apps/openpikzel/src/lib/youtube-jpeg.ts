import sharp from "sharp";

/** YouTube's mobile upload limit is 2 MB: 1280×720 (or 720×1280) mozjpeg, lowering quality until it fits. */
export async function youtubeJpeg(image: Buffer, portrait = false) {
  const [width, height] = portrait ? [720, 1280] : [1280, 720];
  const base = sharp(image, { limitInputPixels: 40000000 }).rotate().resize(width, height, { fit: "cover" });
  for (const quality of [88, 82, 76, 68, 60]) {
    const out = await base.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length < 2 * 1024 * 1024) return out;
  }
  return base.clone().jpeg({ quality: 50, mozjpeg: true }).toBuffer();
}
