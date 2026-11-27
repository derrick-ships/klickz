import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";
import { AppError } from "@/lib/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { db, user } = await authenticated(request);

    // Support lookup by runId OR studyId
    let runRes = await db
      .from("study_runs")
      .select("*, studies(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!runRes.data) {
      runRes = await db
        .from("study_runs")
        .select("*, studies(*)")
        .eq("study_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }
    if (runRes.error || !runRes.data) {
      throw new AppError(404, "Study run not found.");
    }
    const run = runRes.data;

    const [optsRes, repRes, eventsRes] = await Promise.all([
      db
        .from("packaging_options")
        .select(
          "option_key,is_user_draft,angle_label,title,image_path,jpg_path,klickz_score",
        )
        .eq("study_run_id", run.id)
        .order("option_key", { ascending: true }),
      db
        .from("study_reports")
        .select("slug,is_public")
        .eq("study_run_id", run.id)
        .maybeSingle(),
      db
        .from("async_run_events")
        .select("id,phase,progress_pct,message,created_at")
        .eq("run_type", "study_triangulation")
        .eq("run_id", run.id)
        .order("created_at", { ascending: true }),
    ]);

    const paths = (optsRes.data || [])
      .map((o) => o.jpg_path || o.image_path)
      .filter((p): p is string => !!p);
    let signedMap: Record<string, string> = {};
    if (paths.length) {
      const signed = await db.storage
        .from("studio-assets")
        .createSignedUrls(paths, 3600);
      if (!signed.error && signed.data) {
        signedMap = Object.fromEntries(
          signed.data
            .filter((s) => s.path && s.signedUrl)
            .map((s) => [s.path!, s.signedUrl!]),
        );
      }
    }

    const options = (optsRes.data || []).map((o) => ({
      optionKey: o.option_key,
      isUserDraft: o.is_user_draft,
      angleLabel: o.angle_label,
      title: o.title,
      overallScore: o.klickz_score?.overall ?? null,
      imageUrl: signedMap[o.jpg_path || o.image_path || ""] || null,
    }));

    return NextResponse.json(
      {
        run,
        options,
        report: repRes.data || null,
        events: eventsRes.data || [],
        accountEmail: user.email ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
