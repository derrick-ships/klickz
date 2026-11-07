import { reconcileJobs } from "@/lib/jobs";
import { authenticated, failure } from "@/lib/server";
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    await reconcileJobs(db);
    const id = new URL(request.url).searchParams.get("id");
    let q = db
      .from("studio_jobs")
      .select(
        "id,operation,state,max_provider_calls,created_at,updated_at,result",
      )
      .eq("user_id", user.id);
    if (id) q = q.eq("id", id);
    const r = await q.order("created_at", { ascending: false }).limit(30);
    if (r.error) throw r.error;
    return Response.json(
      {
        jobs: r.data,
        notice:
          "Reconciling means dispatch may have executed. No automatic retry is scheduled.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
