import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { limitedJson } from "@/lib/oauth/http";
import { AppError } from "@/lib/validation";
import { startHiggsfield, finishHiggsfield, higgsfieldTools } from "@/lib/higgsfield";
async function context(request: Request) { const result = await authenticated(request); if (result.oauth) throw new AppError(403, "Manage external connections in the app."); return result; }
export async function GET(request: Request) {
 try {
  const { db, user } = await context(request);
  if (new URL(request.url).searchParams.get("check") === "true") return Response.json(await higgsfieldTools(db, user.id), { headers: { "Cache-Control": "no-store" } });
  const result = await db.from("studio_external_connections").select("provider,updated_at").eq("user_id", user.id).eq("provider", "higgsfield").maybeSingle();
  if (result.error) throw result.error;
  return Response.json({ connected: !!result.data, updatedAt: result.data?.updated_at }, { headers: { "Cache-Control": "no-store" } });
 } catch(error) { return failure(error); }
}
export async function POST(request: Request) {
 try {
  sameOrigin(request); const { db, user } = await context(request);
  const input = z.discriminatedUnion("action", [z.object({ action: z.literal("start") }), z.object({ action: z.literal("finish"), state: z.string().uuid(), code: z.string().min(1).max(8000) })]).parse(await limitedJson(request, 12000));
  return Response.json(input.action === "start" ? await startHiggsfield(db, user.id) : await finishHiggsfield(db, user.id, input.state, input.code), { headers: { "Cache-Control": "no-store" } });
 } catch(error) { return failure(error); }
}
export async function DELETE(request: Request) {
 try { sameOrigin(request); const { db, user } = await context(request); const result = await db.from("studio_external_connections").delete().eq("user_id", user.id).eq("provider", "higgsfield"); if (result.error) throw result.error; return Response.json({ disconnected: true }); }
 catch(error) { return failure(error); }
}
