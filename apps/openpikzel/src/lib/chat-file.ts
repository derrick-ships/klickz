import { z } from "zod";
import sharp from "sharp";
import { AppError } from "./validation";

// An image the user attached to (or generated in) a ChatGPT conversation. ChatGPT hands it to a tool
// declared with `_meta["openai/fileParams"]` as { download_url, file_id, mime_type?, file_name? }
// (developers.openai.com/apps-sdk/reference, "Define file inputs").
export const chatFileSchema = z
  .object({
    download_url: z.string().url().max(4000),
    file_id: z.string().min(1).max(200),
    mime_type: z.string().max(100).optional(),
    file_name: z.string().max(300).optional(),
  })
  .strict();
export type ChatFile = z.infer<typeof chatFileSchema>;

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Download a ChatGPT file and return it as a PNG ready to save. HTTPS only, no credentials in the URL,
 * a size cap, a timeout, no redirects to non-HTTPS, and the bytes must decode as PNG, JPEG or WebP.
 */
export async function fetchChatFile(file: ChatFile, fetcher: typeof fetch = fetch): Promise<Buffer> {
  let url: URL;
  try { url = new URL(file.download_url); } catch { throw new AppError(400, "The chat image link is not valid. Attach the image again."); }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new AppError(400, "The chat image link is not valid. Attach the image again.");
  let response: Response;
  try {
    response = await fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
  } catch {
    throw new AppError(502, "The chat image couldn't be downloaded. Attach it again.");
  }
  if (response.url && !response.url.startsWith("https:")) throw new AppError(400, "The chat image link is not valid. Attach the image again.");
  if (!response.ok) throw new AppError(response.status === 403 || response.status === 404 ? 410 : 502, "The chat image link expired. Attach the image again.");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new AppError(413, "Use an image smaller than 20 MB.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new AppError(413, "Use an image smaller than 20 MB.");
  try {
    const image = sharp(bytes, { limitInputPixels: 40000000 });
    const meta = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format || "")) throw new Error("format");
    return await image.rotate().resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch {
    throw new AppError(400, "Use a PNG, JPEG or WebP image.");
  }
}
