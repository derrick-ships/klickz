"use client";
import { use, useCallback, useEffect, useState } from "react";
import { AppShell, useAuthApi } from "@/components/nav/app-shell";
import { useRunProgress } from "@/lib/realtime-progress";

type StudyRunPayload = {
  run: {
    id: string;
    status: string;
    progress_pct: number;
    current_message: string;
    error_message: string | null;
    email_sent_at: string | null;
    studies?: { title_draft?: string; production_mode?: string };
  };
  options: {
    optionKey: "A" | "B" | "C";
    isUserDraft: boolean;
    angleLabel: string;
    title: string;
    overallScore: number | null;
    imageUrl: string | null;
  }[];
  report: { slug: string; is_public: boolean } | null;
  accountEmail: string | null;
};

const PHASES = [
  { id: "leg_a_packaging", label: "Leg A · Packaging & Scoring" },
  { id: "leg_b_pass1", label: "Leg B · Pass 1 Cold Minds" },
  { id: "leg_b_pass2", label: "Leg B · Pass 2 Skepticism" },
  { id: "leg_c_strategist", label: "Leg C · Full-Script Audit" },
  { id: "compiling_deliverables", label: "PDF, Markdown & Email" },
  { id: "completed", label: "Executive Report Ready" },
];

const ORDER = [
  "queued",
  "leg_a_packaging",
  "leg_b_pass1",
  "leg_b_pass2",
  "leg_c_strategist",
  "compiling_deliverables",
  "completed",
];

function StudyTrackerInner({ id }: { id: string }) {
  const { db, session, api } = useAuthApi();
  const [data, setData] = useState<StudyRunPayload | null>(null);
  const [error, setError] = useState("");
  const { run: liveRun, events } = useRunProgress(db, "study_runs", id);

  const load = useCallback(async () => {
    const res = await api<StudyRunPayload>(`/api/studies/${id}`);
    setData(res);
  }, [api, id]);

  useEffect(() => {
    if (session) void load().catch((e) => setError(e.message));
  }, [session, load]);

  // Refresh thumbnails/report slug whenever live phase advances
  useEffect(() => {
    if (session && liveRun?.status) {
      void load().catch(() => {});
    }
  }, [session, liveRun?.status, liveRun?.progress_pct, load]);

  if (error) return <div className="pf-error">{error}</div>;
  if (!data) return <p className="pf-muted">Loading Pre-Flight Study…</p>;

  const status = liveRun?.status || data.run.status;
  const pct = liveRun?.progress_pct ?? data.run.progress_pct;
  const message = liveRun?.current_message || data.run.current_message;
  const currentIdx = ORDER.indexOf(status);

  return (
    <>
      <div className="pf-header">
        <div>
          <a href="/" className="pf-muted" style={{ textDecoration: "none" }}>
            ← All Studies
          </a>
          <h1 style={{ marginTop: "0.25rem" }}>
            {data.run.studies?.title_draft || "Pre-Flight Study"}
          </h1>
          <p className="pf-muted">
            Safe to close this tab or laptop — the study continues in the cloud
            and emails your PDF + Markdown to{" "}
            <strong>{data.accountEmail || "your inbox"}</strong> when done.
          </p>
        </div>
        {data.report && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a href={`/reports/${data.report.slug}`} className="pf-btn-primary">
              Open Executive Report
            </a>
            <a
              href={`/api/reports/${data.report.slug}/download?format=pdf`}
              className="pf-btn-ghost"
            >
              Download PDF
            </a>
            <a
              href={`/api/reports/${data.report.slug}/download?format=md`}
              className="pf-btn-ghost"
            >
              Download .MD
            </a>
          </div>
        )}
      </div>

      <section className="pf-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <strong>{message}</strong>
          <span className="pf-badge pf-badge-neutral">{pct}%</span>
        </div>

        <div className="pf-progress-bar">
          <div className="pf-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="pf-stepper">
          {PHASES.map((phase) => {
            const idx = ORDER.indexOf(phase.id);
            const state =
              status === "completed" || idx < currentIdx
                ? "done"
                : idx === currentIdx
                  ? "active"
                  : "pending";
            return (
              <div key={phase.id} className="pf-step" data-state={state}>
                {phase.label}
              </div>
            );
          })}
        </div>

        {status === "failed" && (
          <div className="pf-error">
            {liveRun?.error_message ||
              data.run.error_message ||
              "Study run failed. Check your API keys and balance."}
          </div>
        )}

        {data.run.email_sent_at && (
          <p className="pf-muted" style={{ marginTop: "0.5rem", color: "#34d399" }}>
            Email delivered with PDF &amp; Markdown attachments at{" "}
            {new Date(data.run.email_sent_at).toLocaleTimeString()}.
          </p>
        )}
      </section>

      {data.options.length > 0 && (
        <section className="pf-card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
            Leg A · Packaging Options Preview ({data.options.length}/3 landed)
          </h2>
          <div className="pf-grid-3">
            {data.options.map((opt) => (
              <div key={opt.optionKey} className="pf-card" style={{ padding: "0.85rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span className="pf-badge pf-badge-neutral">
                    Option {opt.optionKey}
                    {opt.isUserDraft ? " · Your Draft" : ""}
                  </span>
                  {opt.overallScore !== null && (
                    <span className="pf-badge pf-badge-ship">
                      Klickz {opt.overallScore}/100
                    </span>
                  )}
                </div>
                {opt.imageUrl && (
                  <div className="pf-thumb-wrap" style={{ marginBottom: "0.5rem" }}>
                    <img src={opt.imageUrl} alt={opt.title} />
                  </div>
                )}
                <strong style={{ fontSize: "0.9rem" }}>{opt.title}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="pf-card">
          <details open>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              Live Pipeline Log ({events.length})
            </summary>
            <ul
              style={{
                marginTop: "0.6rem",
                paddingLeft: "1.1rem",
                fontSize: "0.84rem",
                color: "#a1a1aa",
              }}
            >
              {events.map((ev) => (
                <li key={ev.id} style={{ marginBottom: "0.25rem" }}>
                  [{ev.progress_pct}%] {ev.message}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}

export default function StudyTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell>
      <StudyTrackerInner id={id} />
    </AppShell>
  );
}
