import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { AppError } from "@/lib/validation";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    if (oauth) throw new AppError(403, "Manage access in the app.");
    const r = await db
      .from("studio_oauth_grants")
      .select("id,client_name,scope,created_at,expires_at,revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (r.error) throw r.error;
    return Response.json(
      { grants: r.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { db, user, oauth } = await authenticated(request);
    if (oauth) throw new AppError(403, "Manage access in the app.");
    const { id } = z
      .object({ id: z.string().uuid() })
      .parse(await request.json());
    const r = await db
      .from("studio_oauth_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (r.error) throw r.error;
    return Response.json({ revoked: true });
  } catch (e) {
    return failure(e);
  }
}
