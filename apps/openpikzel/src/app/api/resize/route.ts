import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { AppError } from "@/lib/validation";
import { ownedAsset } from "@/lib/assets";
import { resizeThumbnail } from "@/lib/providers";
import { NextResponse } from "next/server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const context = await authenticated(request);
    const { db, user } = context;
    if (context.oauth && !context.oauth.scope.includes("studio:write"))
      throw new AppError(403, "Agent needs studio:write permission.");
    const input = z
      .object({
        creationId: z.string().uuid(),
        format: z.enum(["long", "short"]),
        requestId: z.string().uuid(),
      })
      .parse(await request.json());
    const { data: original, error } = await db
      .from("studio_creations")
      .select("*")
      .eq("id", input.creationId)
      .eq("user_id", user.id)
      .single();
    if (error || !original?.image_path)
      throw new AppError(404, "Choose an image to resize.");
    const reserved = await db
      .from("studio_creations")
      .insert({
        user_id: user.id,
        title: original.title,
        prompt: original.prompt,
        style: original.style,
        mode: "resize",
        parent_id: original.id,
        settings: { ...original.settings, format: input.format },
        request_id: input.requestId,
        status: "generating",
      })
      .select("id")
      .single();
    if (reserved.error) {
      if (reserved.error.code === "23505")
        throw new AppError(409, "Resize already submitted.");
      throw reserved.error;
    }
    try {
      const image = await resizeThumbnail(
        await ownedAsset(db, user.id, original.image_path),
        input.format,
      );
      const path = `${user.id}/creations/${reserved.data.id}.png`;
      const uploaded = await db.storage
        .from("studio-assets")
        .upload(path, image, { contentType: "image/png" });
      if (uploaded.error) throw uploaded.error;
      const saved = await db
        .from("studio_creations")
        .update({ image_path: path, status: "ready" })
        .eq("id", reserved.data.id)
        .select("*")
        .single();
      if (saved.error) throw saved.error;
      return NextResponse.json({ creation: saved.data });
    } catch (e) {
      await db
        .from("studio_creations")
        .update({ status: "failed" })
        .eq("id", reserved.data.id);
      throw e;
    }
  } catch (e) {
    return failure(e);
  }
}
