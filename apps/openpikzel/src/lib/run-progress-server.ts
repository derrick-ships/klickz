import "server-only";
import { adminDb } from "./admin-db";

export type RunType = "channel_ingestion" | "study_triangulation";

/**
 * Updates parent run status/progress and appends a live audit event
 * streamed to the browser via Supabase Realtime (plus polling fallback).
 */
export async function emitRunProgress(
  runType: RunType,
  runId: string,
  userId: string,
  update: {
    status: string;
    progressPct: number;
    message: string;
    metadata?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  const db = adminDb();
  const table =
    runType === "channel_ingestion" ? "channel_ingestion_runs" : "study_runs";
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: update.status,
    progress_pct: Math.max(0, Math.min(100, Math.round(update.progressPct))),
    current_message: update.message.slice(0, 400),
    updated_at: now,
  };
  if (update.errorMessage !== undefined) {
    patch.error_message = update.errorMessage;
  }
  if (runType === "study_triangulation" && update.status === "completed") {
    patch.completed_at = now;
  }
  const [runRes, evRes] = await Promise.all([
    db.from(table).update(patch).eq("id", runId).eq("user_id", userId),
    db.from("async_run_events").insert({
      run_type: runType,
      run_id: runId,
      user_id: userId,
      phase: update.status,
      progress_pct: patch.progress_pct,
      message: update.message.slice(0, 400),
      metadata: update.metadata ?? {},
    }),
  ]);
  if (runRes.error) {
    console.error(`[run-progress] failed updating ${table}:`, {
      code: runRes.error.code,
      message: runRes.error.message,
    });
  }
  if (evRes.error) {
    console.error("[run-progress] failed inserting async_run_events:", {
      code: evRes.error.code,
      message: evRes.error.message,
    });
  }
}
