import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";

// Honest progress: the median of this user's last 20 finished image jobs (created → updated).
// The client fills a bar up to 95% of that time and jumps to 100% only when the image arrives.
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    const r = await db.from("studio_jobs").select("created_at,updated_at").eq("user_id", user.id).eq("operation", "generate").eq("state", "succeeded").order("created_at", { ascending: false }).limit(20);
    if (r.error) throw r.error;
    const ms = (r.data || []).map((j) => Date.parse(j.updated_at) - Date.parse(j.created_at)).filter((n) => n > 2000 && n < 330000).sort((a, b) => a - b);
    const median = ms.length ? ms[Math.floor(ms.length / 2)] : null;
    return NextResponse.json({ medianMs: median, samples: ms.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
