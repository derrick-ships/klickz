"use client";
import { useEffect, useState } from "react";
import { AppShell, useAuthApi } from "@/components/nav/app-shell";

type StudyListItem = {
  id: string;
  titleDraft: string;
  productionMode: "pre_shoot" | "footage_locked";
  language: string;
  createdAt: string;
  channelTitle: string;
  latestRun: {
    id: string;
    status: string;
    progress_pct: number;
    current_message: string;
    email_sent_at: string | null;
  } | null;
  report: {
    slug: string;
    isPublic: boolean;
    verdictCode: "SHIP" | "ITERATE" | "RETHINK" | null;
    winningOptionKey: string | null;
  } | null;
};

type ChannelSummary = {
  id: string;
  title: string;
  handle: string | null;
  primary_language: string;
  latestAudience: {
    id: string;
    status: string;
    activeMinds: number;
    totalMinds: number;
  } | null;
};

function StudiesDashboardInner() {
  const { session, api } = useAuthApi();
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    let live = true;
    Promise.all([
      api<{ studies: StudyListItem[] }>("/api/studies"),
      api<{ channels: ChannelSummary[] }>("/api/channels"),
    ])
      .then(([s, c]) => {
        if (!live) return;
        setStudies(s.studies || []);
        setChannels(c.channels || []);
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Could not load dashboard.");
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [session, api]);

  const readyChannels = channels.filter(
    (c) => c.latestAudience?.status === "ready",
  );

  return (
    <>
      <div className="pf-header">
        <div>
          <h1>Pre-Flight Packaging Studies</h1>
          <p className="pf-muted">
            Start a deep 3–5 minute audience &amp; script study, close the tab,
            and get the finished PDF + Markdown report straight in Gmail.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <a href="/channels" className="pf-btn-ghost">
            Channels &amp; Minds ({channels.length})
          </a>
          <a href="/studies/new" className="pf-btn-primary">
            + New Pre-Flight Study
          </a>
        </div>
      </div>

      {error && <div className="pf-error">{error}</div>}

      {!loading && readyChannels.length === 0 && (
        <div className="pf-card" style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Step 1: Connect a YouTube Channel</h2>
          <p className="pf-muted" style={{ marginBottom: "1rem" }}>
            Link your channel (or a client/competitor channel) to extract real
            outliers, comments, and transcripts — and generate your persistent
            panel of 16 synthetic audience Minds.
          </p>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <a href="/channels" className="pf-btn-primary">
              Connect YouTube Channel
            </a>
            <a href="/connect" className="pf-btn-ghost">
              Check API Keys
            </a>
          </div>
        </div>
      )}

      {loading ? (
        <p className="pf-muted">Loading studies…</p>
      ) : studies.length === 0 ? (
        <div className="pf-card">
          <h2 style={{ marginTop: 0 }}>No Pre-Flight Studies yet</h2>
          <p className="pf-muted" style={{ marginBottom: "1rem" }}>
            Paste your full script, draft title, and optional draft thumbnail.
            We&apos;ll generate challengers, test them across your 16 Minds, audit
            the entire script, and email your Executive Report.
          </p>
          <a href="/studies/new" className="pf-btn-primary">
            Launch Your First Study
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {studies.map((s) => {
            const verdict = s.report?.verdictCode;
            const badgeClass =
              verdict === "SHIP"
                ? "pf-badge pf-badge-ship"
                : verdict === "ITERATE"
                  ? "pf-badge pf-badge-iterate"
                  : verdict === "RETHINK"
                    ? "pf-badge pf-badge-rethink"
                    : "pf-badge pf-badge-neutral";
            return (
              <article key={s.id} className="pf-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <span className={badgeClass}>
                        {verdict || s.latestRun?.status || "draft"}
                      </span>
                      <span className="pf-badge pf-badge-neutral">
                        {s.productionMode === "pre_shoot"
                          ? "Pre-Shoot"
                          : "Footage Locked"}
                      </span>
                      <span className="pf-muted">
                        {s.channelTitle} · {s.language.toUpperCase()} ·{" "}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 style={{ margin: "0.2rem 0", fontSize: "1.15rem" }}>
                      {s.titleDraft}
                    </h2>
                    {s.latestRun && s.latestRun.status !== "completed" && (
                      <p className="pf-muted">
                        {s.latestRun.current_message} ({s.latestRun.progress_pct}
                        %)
                      </p>
                    )}
                    {s.latestRun?.email_sent_at && (
                      <p className="pf-muted" style={{ fontSize: "0.8rem" }}>
                        Emailed PDF + Markdown{" "}
                        {new Date(s.latestRun.email_sent_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {s.report ? (
                      <>
                        <a
                          href={`/reports/${s.report.slug}`}
                          className="pf-btn-primary"
                        >
                          Open Report
                        </a>
                        <a
                          href={`/api/reports/${s.report.slug}/download?format=pdf`}
                          className="pf-btn-ghost"
                        >
                          PDF
                        </a>
                        <a
                          href={`/api/reports/${s.report.slug}/download?format=md`}
                          className="pf-btn-ghost"
                        >
                          .MD
                        </a>
                      </>
                    ) : s.latestRun ? (
                      <a
                        href={`/studies/${s.latestRun.id}`}
                        className="pf-btn-ghost"
                      >
                        Track Progress ({s.latestRun.progress_pct}%)
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

export function StudiesDashboard() {
  return (
    <AppShell>
      <StudiesDashboardInner />
    </AppShell>
  );
}
