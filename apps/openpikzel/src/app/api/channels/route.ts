import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    const [chRes, audRes, runsRes] = await Promise.all([
      db
        .from("channels")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      db
        .from("audiences")
        .select("id,channel_id,version,language,status,created_at,audience_minds(id,active)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("channel_ingestion_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (chRes.error) throw chRes.error;
    if (audRes.error) throw audRes.error;

    const latestAudienceByChannel = new Map<string, (typeof audRes.data)[number]>();
    for (const a of audRes.data || []) {
      if (!latestAudienceByChannel.has(a.channel_id)) {
        latestAudienceByChannel.set(a.channel_id, a);
      }
    }

    const channels = (chRes.data || []).map((c) => {
      const aud = latestAudienceByChannel.get(c.id);
      const minds = Array.isArray(aud?.audience_minds) ? aud.audience_minds : [];
      return {
        ...c,
        latestAudience: aud
          ? {
              id: aud.id,
              version: aud.version,
              language: aud.language,
              status: aud.status,
              totalMinds: minds.length,
              activeMinds: minds.filter((m: { active: boolean }) => m.active).length,
            }
          : null,
      };
    });

    return NextResponse.json(
      { channels, recentRuns: runsRes.data || [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
