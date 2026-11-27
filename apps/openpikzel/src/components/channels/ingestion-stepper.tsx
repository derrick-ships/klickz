"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRunProgress } from "@/lib/realtime-progress";

const STAGES = [
  { id: "extracting_signals", label: "1. Extracting audience signals" },
  { id: "building_distributions", label: "2. Building distributions" },
  { id: "preparing_minds", label: "3. Preparing 16 Minds" },
  { id: "completed", label: "4. Audience ready" },
];

const ORDER = [
  "queued",
  "extracting_signals",
  "building_distributions",
  "preparing_minds",
  "completed",
];

export function IngestionStepper({
  db,
  runId,
  onCompleted,
}: {
  db: SupabaseClient | null;
  runId: string;
  onCompleted?: (channelId?: string | null) => void;
}) {
  const { run, events } = useRunProgress(db, "channel_ingestion_runs", runId);
  const currentIdx = ORDER.indexOf(run?.status || "queued");

  return (
    <div className="pf-card" style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <strong>Building Channel Audience &amp; 16 Minds</strong>
        <span className="pf-badge pf-badge-neutral">
          {run?.progress_pct ?? 5}%
        </span>
      </div>

      <div className="pf-progress-bar">
        <div
          className="pf-progress-fill"
          style={{ width: `${run?.progress_pct ?? 5}%` }}
        />
      </div>

      <p className="pf-muted" style={{ marginBottom: "0.75rem" }}>
        {run?.current_message || "Starting background ingestion…"} — Safe to
        leave this page; work continues in the background.
      </p>

      <div className="pf-stepper">
        {STAGES.map((stage) => {
          const idx = ORDER.indexOf(stage.id);
          const state =
            run?.status === "completed" || idx < currentIdx
              ? "done"
              : idx === currentIdx
                ? "active"
                : "pending";
          return (
            <div key={stage.id} className="pf-step" data-state={state}>
              {stage.label}
            </div>
          );
        })}
      </div>

      {run?.status === "failed" && (
        <div className="pf-error">
          {run.error_message || "Channel ingestion failed. Check your keys and try again."}
        </div>
      )}

      {run?.status === "completed" && (
        <div style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="pf-btn-primary"
            onClick={() => onCompleted?.(run.channel_id)}
          >
            Inspect Audience &amp; 16 Minds
          </button>
        </div>
      )}

      {events.length > 0 && (
        <details style={{ marginTop: "0.75rem" }}>
          <summary className="pf-muted" style={{ cursor: "pointer" }}>
            Live activity log ({events.length} updates)
          </summary>
          <ul
            style={{
              marginTop: "0.5rem",
              paddingLeft: "1.1rem",
              fontSize: "0.82rem",
              color: "#a1a1aa",
            }}
          >
            {events.map((ev) => (
              <li key={ev.id}>
                [{ev.progress_pct}%] {ev.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
