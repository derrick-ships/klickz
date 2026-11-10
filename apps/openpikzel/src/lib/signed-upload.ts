import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, ownedPath } from "./validation";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_USE_BYTES = 5 * 1024 * 1024;

export const uploadTime = {
  now() {
    return new Date();
  },
};

export async function decodeInlineImage(base64: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0)
    throw new AppError(400, "Use plain base64 without a data URL prefix.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 2 * 1024 * 1024)
    throw new AppError(413, "Use an image smaller than 2 MB.");
  try {
    const decoded = sharp(bytes, { limitInputPixels: 40000000 }),
      meta = await decoded.metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format || ""))
      throw new AppError(400, "Use PNG, JPEG or WebP.");
    return decoded
      .rotate()
      .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "Use PNG, JPEG or WebP.");
  }
}

export async function saveOwnedReference(
  db: SupabaseClient,
  userId: string,
  image: Buffer,
) {
  const path = `${userId}/references/${crypto.randomUUID()}.png`;
  const result = await db.storage
    .from("studio-assets")
    .upload(path, image, { contentType: "image/png" });
  if (result.error) throw result.error;
  return path;
}

export async function issueSignedUpload(db: SupabaseClient, userId: string) {
  const id = crypto.randomUUID(),
    path = `${userId}/references/${id}.png`,
    issued_at = uploadTime.now(),
    expires_at = new Date(issued_at.getTime() + FIVE_MINUTES_MS);
  const saved = await db
    .from("studio_upload_urls")
    .insert({
      id,
      user_id: userId,
      path,
      issued_at: issued_at.toISOString(),
      expires_at: expires_at.toISOString(),
    })
    .select("id,path,issued_at,expires_at")
    .single();
  if (saved.error) throw new AppError(503, "The upload link could not be created.");
  const signed = await db.storage.from("studio-assets").createSignedUploadUrl(path);
  if (signed.error || !signed.data)
    throw new AppError(503, "The upload link could not be created.");
  return {
    imagePath: path,
    signedUrl: signed.data.signedUrl,
    expires_at: expires_at.toISOString(),
    uploadCommand: `curl -X PUT --data-binary @image.png -H "Content-Type: image/png" "${signed.data.signedUrl}"`,
  };
}

async function storageObject(db: SupabaseClient, path: string) {
  const slash = path.lastIndexOf("/"),
    folder = path.slice(0, slash),
    name = path.slice(slash + 1);
  const listed = await db.storage
    .from("studio-assets")
    .list(folder, { search: name, limit: 100 });
  if (listed.error) throw new AppError(503, "The upload could not be checked.");
  return (listed.data || []).find((item: { name: string }) => item.name === name) || null;
}

export async function claimSignedUpload(
  db: SupabaseClient,
  userId: string,
  path: string,
  requestId: string,
) {
  if (!ownedPath(path, userId))
    throw new AppError(403, "This reference is not in your library.");
  const found = await db
    .from("studio_upload_urls")
    .select("*")
    .eq("path", path)
    .eq("user_id", userId)
    .maybeSingle();
  const row = found.data;
  if (!row) return { tracked: false as const };
  if (row.used_at && row.used_request_id !== requestId)
    throw new AppError(
      409,
      "This upload was already analyzed. Request a new upload link.",
    );
  const object = await storageObject(db, path);
  if (!object?.created_at) throw new AppError(404, "No file was uploaded for this link.");
  if (new Date(object.created_at).getTime() > new Date(row.expires_at).getTime())
    throw new AppError(400, "upload link expired, request a new one");
  const metadata = (object.metadata || {}) as { size?: number; mimetype?: string };
  const size = metadata.size;
  if (typeof size === "number" && size > MAX_USE_BYTES)
    throw new AppError(413, "Use an image smaller than 5 MB.");
  const mime = metadata.mimetype;
  if (mime && !["image/png", "image/jpeg", "image/webp"].includes(String(mime)))
    throw new AppError(400, "Use PNG, JPEG or WebP.");
  if (!row.used_at) {
    const claimed = await db
      .from("studio_upload_urls")
      .update({
        used_at: uploadTime.now().toISOString(),
        used_request_id: requestId,
      })
      .eq("id", row.id)
      .eq("user_id", userId)
      .is("used_at", null)
      .select("id");
    if (claimed.error) throw new AppError(503, "The upload could not be claimed.");
    const updated = Array.isArray(claimed.data)
      ? claimed.data
      : claimed.data
        ? [claimed.data]
        : [];
    if (!updated.length)
      throw new AppError(
        409,
        "This upload was already analyzed. Request a new upload link.",
      );
  }
  return { tracked: true as const };
}
