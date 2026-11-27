import sharp from "sharp";
import { analyzePixels, verdicts, type FeedCheck, type Verdict } from "../feed-check";

export type ServerFeedCheckResult = {
  metrics: FeedCheck;
  verdicts: Verdict[];
  allPass: boolean;
};

/**
 * Server-side Sharp implementation of `feed-check.ts` pixel legibility tests
 * (dark feed contrast, light feed contrast, grayscale tonal range).
 */
export async function serverFeedCheck(
  imageBuffer: Buffer,
  sample = 96,
): Promise<ServerFeedCheckResult> {
  const { data, info } = await sharp(imageBuffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize(sample, sample, { fit: "inside", withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const metrics = analyzePixels(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
  );
  const v = verdicts(metrics);
  return {
    metrics,
    verdicts: v,
    allPass: v.every((item) => item.pass),
  };
}
