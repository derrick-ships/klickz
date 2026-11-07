import { z } from "zod";
import { authenticated, failure, requireAI } from "@/lib/server";
import { AppError } from "@/lib/validation";
import { ownedAsset } from "@/lib/assets";
import { prepareIdentity } from "@/lib/providers";
import { NextResponse } from "next/server";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    requireAI("openai");
    const input = z
      .object({ id: z.string().uuid(), kind: z.enum(["persona", "style"]) })
      .parse(await request.json());
    const table =
      input.kind === "persona" ? "studio_personas" : "studio_styles";
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq("id", input.id)
      .eq("user_id", user.id)
      .single();
    if (error || !data) throw new AppError(404, "Profile not found.");
    const images = await Promise.all(
      data.refs.slice(0, 3).map((p: string) => ownedAsset(db, user.id, p)),
    );
    const identity_brief = await prepareIdentity(images, data.name, input.kind);
    const saved = await db
      .from(table)
      .update({ identity_brief, profile_status: "ready" })
      .eq("id", input.id)
      .select("*")
      .single();
    if (saved.error) throw saved.error;
    return NextResponse.json({
      profile: saved.data,
      method: "reference-guided",
    });
  } catch (e) {
    return failure(e);
  }
}
