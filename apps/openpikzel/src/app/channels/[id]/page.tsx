"use client";
import { use, useCallback, useEffect, useState } from "react";
import { AppShell, useAuthApi } from "@/components/nav/app-shell";
import { MindCard } from "@/components/channels/mind-card";
import type { MindArchetype, PersistedMind } from "@/lib/schemas/audience";

type ChannelDetailPayload = {
  channel: {
    id: string;
    title: string;
    handle: string | null;
    primary_language: string;
    median_views: number;
    subscriber_count: number | null;
  };
  audience: {
    id: string;
    language: string;
    demographics: {
      age_bands?: { label: string; share_pct: number }[];
      geo_and_culture?: string;
      viewer_tenure_split?: string;
    };
    psychographics: {
      core_motivations?: string[];
      recurring_pain_points?: string[];
      skepticism_patterns?: string[];
      tone_preferences?: string;
    };
    comment_themes: { theme: string; sentiment: string; example_signal: string }[];
    outlier_patterns: {
      what_wins?: string[];
      what_flops?: string[];
    };
  } | null;
  minds: PersistedMind[];
  videos: {
    id: string;
    title: string;
    view_count: number;
    outlier_ratio: number;
    transcript_source: string | null;
  }[];
};

function ChannelDetailInner({ id }: { id: string }) {
  const { session, api } = useAuthApi();
  const [data, setData] = useState<ChannelDetailPayload | null>(null);
  const [filter, setFilter] = useState<"all" | MindArchetype>("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<ChannelDetailPayload>(`/api/channels/${id}`);
    setData(res);
  }, [api, id]);

  useEffect(() => {
    if (session) void load().catch((e) => setError(e.message));
  }, [session, load]);

  if (error) return <div className="pf-error">{error}</div>;
  if (!data) return <p className="pf-muted">Loading channel audience…</p>;

  const activeCount = data.minds.filter((m) => m.active).length;
  const visibleMinds =
    filter === "all"
      ? data.minds
      : data.minds.filter((m) => m.archetype === filter);

  async function saveMind(patch: {
    mindId: string;
    active?: boolean;
    role?: string;
    click_bar?: number;
    skepticism_triggers?: string[];
  }) {
    await api(`/api/channels/${id}`, "PATCH", patch);
    await load();
  }

  return (
    <>
      <div className="pf-header">
        <div>
          <a href="/channels" className="pf-muted" style={{ textDecoration: "none" }}>
            ← All Channels
          </a>
          <h1 style={{ marginTop: "0.25rem" }}>{data.channel.title}</h1>
          <p className="pf-muted">
            Language: {data.channel.primary_language.toUpperCase()} · Median{" "}
            {data.channel.median_views.toLocaleString()} views · {activeCount}/
            {data.minds.length} Active Minds
          </p>
        </div>
        {data.audience && (
          <a
            href={`/studies/new?audienceId=${data.audience.id}`}
            className="pf-btn-primary"
          >
            + New Study with These {activeCount} Minds
          </a>
        )}
      </div>

      {data.audience && (
        <div className="pf-grid-2" style={{ marginBottom: "1.5rem" }}>
          <section className="pf-card">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
              Demographics &amp; Comment Themes
            </h2>
            <p className="pf-muted" style={{ marginBottom: "0.6rem" }}>
              {data.audience.demographics?.geo_and_culture}
            </p>
            <div className="pf-chip-row" style={{ marginBottom: "0.75rem" }}>
              {(data.audience.demographics?.age_bands || []).map((b) => (
                <span key={b.label} className="pf-badge pf-badge-neutral">
                  {b.label}: {b.share_pct}%
                </span>
              ))}
            </div>
            <ul style={{ paddingLeft: "1.1rem", fontSize: "0.86rem", margin: 0 }}>
              {(data.audience.comment_themes || []).map((t, i) => (
                <li key={i} style={{ marginBottom: "0.35rem" }}>
                  <strong>{t.theme}</strong> ({t.sentiment}): {t.example_signal}
                </li>
              ))}
            </ul>
          </section>

          <section className="pf-card">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
              Psychographics &amp; Outlier Patterns
            </h2>
            <p className="pf-muted" style={{ marginBottom: "0.5rem" }}>
              {data.audience.psychographics?.tone_preferences}
            </p>
            <strong style={{ fontSize: "0.85rem" }}>What Wins:</strong>
            <ul style={{ paddingLeft: "1.1rem", fontSize: "0.85rem", margin: "0.25rem 0 0.6rem" }}>
              {(data.audience.outlier_patterns?.what_wins || []).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <strong style={{ fontSize: "0.85rem" }}>Skepticism Triggers:</strong>
            <ul style={{ paddingLeft: "1.1rem", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
              {(data.audience.psychographics?.skepticism_patterns || []).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Persistent Audience Minds ({activeCount} active · min 12)
        </h2>
        <div className="pf-chip-row">
          {(["all", "loyalist", "casual_scroller", "skeptic", "new_viewer"] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                className="pf-chip"
                data-active={filter === key}
                onClick={() => setFilter(key)}
              >
                {key === "all" ? `All (${data.minds.length})` : key.replace("_", " ")}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="pf-grid-3">
        {visibleMinds.map((mind) => (
          <MindCard
            key={mind.id}
            mind={mind}
            canDeactivate={activeCount > 12}
            onSave={saveMind}
          />
        ))}
      </div>
    </>
  );
}

export default function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AppShell>
      <ChannelDetailInner id={id} />
    </AppShell>
  );
}
