import {profileTable,elementDefinitions,type ElementKind} from "@/lib/elements";
import { z } from "zod";
import {
  authenticated,
  failure,
  requireAI,
  withUserProviders,
} from "@/lib/server";
import { AppError, textProviderSchema } from "@/lib/validation";
import { ownedAsset } from "@/lib/assets";
import { prepareIdentity } from "@/lib/providers";
import { NextResponse } from "next/server";
export const maxDuration = 120;
async function handle(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    const input = z
      .object({ id: z.string().uuid(), kind: z.enum(["persona", "style", "element"]), provider: textProviderSchema })
      .parse(await request.json());
    requireAI(input.provider);
    const table =
      profileTable(input.kind);
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
    const identity_brief = await prepareIdentity(images, input.kind === "element" ? `${data.name}: ${elementDefinitions[data.kind as ElementKind].description}` : data.name, input.kind, input.provider);
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

export const POST = (request: Request) =>
  withUserProviders(request, () => handle(request), [
    "studio:ai",
    "studio:write",
  ]);
