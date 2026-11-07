import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, ownedPath } from "./validation";
export async function ownedAsset(
  db: SupabaseClient,
  userId: string,
  path: string,
) {
  if (!ownedPath(path, userId))
    throw new AppError(403, "This reference is not in your library.");
  const { data, error } = await db.storage.from("studio-assets").download(path);
  if (error || !data)
    throw new AppError(404, "Reference image not found. Upload it again.");
  if (data.size > 5 * 1024 * 1024)
    throw new AppError(413, "Use an image smaller than 5 MB.");
  return sharp(Buffer.from(await data.arrayBuffer()), {
    limitInputPixels: 40000000,
  })
    .rotate()
    .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
