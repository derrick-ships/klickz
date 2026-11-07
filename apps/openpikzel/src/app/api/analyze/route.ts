import {
  authenticated,
  failure,
  requireAI,
  withUserProviders,
} from "@/lib/server";
import { reviewSchema, AppError } from "@/lib/validation";
import { evaluateThumbnail } from "@/lib/providers";
import { ownedAsset } from "@/lib/assets";
import { NextResponse } from "next/server";
export const maxDuration = 180;
async function handle(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    requireAI("jev");
    const input = reviewSchema.parse(await request.json());
    let path = input.imagePath;
    let id = input.creationId;
    if (id) {
      const { data, error } = await db
        .from("studio_creations")
        .select("image_path")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (error || !data?.image_path)
        throw new AppError(404, "Choose an uploaded or generated thumbnail.");
      path = data.image_path;
    }
    if (!path) throw new AppError(400, "Choose a thumbnail.");
    const image = await ownedAsset(db, user.id, path);
    const score = await evaluateThumbnail(
      image,
      input.title,
      crypto.randomUUID(),
    );
    if (id) {
      const saved = await db
        .from("studio_creations")
        .update({ score, title: input.title })
        .eq("id", id)
        .eq("user_id", user.id);
      if (saved.error) throw saved.error;
    } else {
      const saved = await db
        .from("studio_creations")
        .insert({
          user_id: user.id,
          title: input.title,
          prompt: input.title.padEnd(8, "."),
          mode: "generate",
          style: "Uploaded",
          image_path: path,
          status: "ready",
          score,
        })
        .select("id")
        .single();
      if (saved.error) throw saved.error;
      id = saved.data.id;
    }
    return NextResponse.json({ score, creationId: id });
  } catch (e) {
    return failure(e);
  }
}

export const POST = (request: Request) =>
  withUserProviders(request, () => handle(request), [
    "studio:ai",
    "studio:write",
  ]);
