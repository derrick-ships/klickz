import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { mindPatchSchema } from "@/lib/schemas/audience";
import { AppError } from "@/lib/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { db, user } = await authenticated(request);

    const chRes = await db
      .from("channels")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (chRes.error || !chRes.data) {
      throw new AppError(404, "Channel not found.");
    }

    const [audRes, vidsRes, runRes] = await Promise.all([
      db
        .from("audiences")
        .select("*")
        .eq("channel_id", id)
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("channel_videos")
        .select(
          "id,youtube_video_id,title,view_count,outlier_ratio,thumbnail_url,published_at,transcript_source",
        )
        .eq("channel_id", id)
        .eq("user_id", user.id)
        .order("outlier_ratio", { ascending: false })
        .limit(20),
      db
        .from("channel_ingestion_runs")
        .select("*")
        .eq("channel_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const minds = audRes.data
      ? (
          await db
            .from("audience_minds")
            .select("*")
            .eq("audience_id", audRes.data.id)
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true })
        ).data || []
      : [];

    return NextResponse.json(
      {
        channel: chRes.data,
        audience: audRes.data || null,
        minds,
        videos: vidsRes.data || [],
        latestRun: runRes.data || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await context.params;
    const { db, user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write")) {
      throw new AppError(403, "Allow write access to edit Minds.");
    }
    const input = mindPatchSchema.parse(await request.json());

    const patch: Record<string, unknown> = {};
    if (input.active !== undefined) patch.active = input.active;
    if (input.name !== undefined) patch.name = input.name;
    if (input.role !== undefined) patch.role = input.role;
    if (input.click_bar !== undefined) patch.click_bar = input.click_bar;
    if (input.skepticism_triggers !== undefined)
      patch.skepticism_triggers = input.skepticism_triggers;
    if (input.thinking_patterns !== undefined)
      patch.thinking_patterns = input.thinking_patterns;

    const updated = await db
      .from("audience_minds")
      .update(patch)
      .eq("id", input.mindId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updated.error || !updated.data) {
      throw new AppError(404, "Mind not found.");
    }
    return NextResponse.json({ mind: updated.data });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { db, user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write")) {
      throw new AppError(403, "Allow write access to delete a channel.");
    }
    const del = await db
      .from("channels")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (del.error) throw del.error;
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
