"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProgressRunState = {
  id: string;
  status: string;
  progress_pct: number;
  current_message: string;
  error_message?: string | null;
  channel_id?: string | null;
};

export type ProgressEventItem = {
  id: string;
  phase: string;
  progress_pct: number;
  message: string;
  created_at: string;
};

/**
 * Live run progress hook subscribing to Supabase Realtime Postgres changes
 * on the run row & `async_run_events`, with a resilient 5s polling fallback.
 */
export function useRunProgress(
  db: SupabaseClient | null,
  table: "channel_ingestion_runs" | "study_runs",
  runId: string | null,
) {
  const [run, setRun] = useState<ProgressRunState | null>(null);
  const [events, setEvents] = useState<ProgressEventItem[]>([]);

  useEffect(() => {
    if (!db || !runId) return;
    let active = true;
    const runType =
      table === "channel_ingestion_runs"
        ? "channel_ingestion"
        : "study_triangulation";

    async function fetchLatest() {
      if (!db || !runId) return;
      const [runRes, evRes] = await Promise.all([
        db.from(table).select("*").eq("id", runId).maybeSingle(),
        db
          .from("async_run_events")
          .select("id,phase,progress_pct,message,created_at")
          .eq("run_type", runType)
          .eq("run_id", runId)
          .order("created_at", { ascending: true }),
      ]);
      if (!active) return;
      if (runRes.data) setRun(runRes.data as ProgressRunState);
      if (evRes.data) setEvents(evRes.data as ProgressEventItem[]);
    }

    void fetchLatest();

    const channel = db
      .channel(`progress:${table}:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          if (active && payload.new) {
            setRun(payload.new as ProgressRunState);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "async_run_events",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          if (active && payload.new) {
            const ev = payload.new as ProgressEventItem;
            setEvents((prev) =>
              prev.some((x) => x.id === ev.id) ? prev : [...prev, ev],
            );
          }
        },
      )
      .subscribe();

    const poll = setInterval(() => {
      void fetchLatest();
    }, 5000);

    return () => {
      active = false;
      clearInterval(poll);
      void db.removeChannel(channel);
    };
  }, [db, table, runId]);

  return { run, events };
}
