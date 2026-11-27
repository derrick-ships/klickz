"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, useAuthApi } from "@/components/nav/app-shell";
import { IngestionStepper } from "@/components/channels/ingestion-stepper";

type ChannelRow = {
  id: string;
  title: string;
  handle: string | null;
  avatar_url: string;
  primary_language: string;
  subscriber_count: number | null;
  median_views: number;
  latestAudience: {
    id: string;
    version: number;
    status: string;
    totalMinds: number;
    activeMinds: number;
  } | null;
};

type RunRow = {
  id: string;
  status: string;
  input_identifier: string;
};

function isLikelyYouTubeChannel(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/^@[\w.-]{2,60}$/.test(s)) return true;
  if (/^UC[\w-]{22}$/.test(s)) return true;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return /(^|\.)youtube\.com$/i.test(u.hostname) && u.pathname.length > 1;
  } catch {
    return false;
  }
}

function ChannelsInner() {
  const router = useRouter();
  const { db, session, api } = useAuthApi();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [channelInput, setChannelInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ channels: ChannelRow[]; recentRuns: RunRow[] }>(
        "/api/channels",
      );
      setChannels(res.channels || []);
      const running = (res.recentRuns || []).find(
        (r) => !["completed", "failed"].includes(r.status),
      );
      if (running) setActiveRunId(running.id);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (userId) void load().catch((e) => setError(e.message));
  }, [userId, load]);

  const trimmedInput = channelInput.trim();
  const inputInvalid = trimmedInput.length > 0 && !isLikelyYouTubeChannel(trimmedInput);

  async function startIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedInput || inputInvalid) {
      setError("Enter a valid YouTube channel URL (youtube.com/@handle), @handle, or UC... channel ID.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{ runId: string }>("/api/channels/ingest", "POST", {
        channel: trimmedInput,
      });
      setActiveRunId(res.runId);
      setChannelInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start ingestion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pf-header">
        <div>
          <h1>Channels &amp; Persistent Audience Minds</h1>
          <p className="pf-muted">
            Connect any YouTube channel (your own, clients, or competitors) to
            extract outliers, comments, and transcripts into 16 persistent Minds.
          </p>
        </div>
      </div>

      <form className="pf-card" style={{ marginBottom: "1.25rem" }} onSubmit={startIngest}>
        <div className="pf-field" style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="yt-channel">YouTube Channel URL or @handle</label>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <input
              id="yt-channel"
              className="pf-input"
              style={{ flex: 1, minWidth: 240 }}
              placeholder="https://youtube.com/@creator or @creator"
              value={channelInput}
              aria-invalid={inputInvalid}
              onChange={(e) => {
                setChannelInput(e.target.value);
                if (error) setError("");
              }}
            />
            <button
              type="submit"
              className="pf-btn-primary"
              disabled={busy || !trimmedInput || inputInvalid}
            >
              {busy ? "Starting…" : "Extract Audience & Build 16 Minds"}
            </button>
          </div>
          {inputInvalid ? (
            <p className="pf-error" style={{ marginTop: "0.4rem", marginBottom: 0 }}>
              Use a YouTube URL (https://youtube.com/@handle), an @handle, or a UC... channel ID.
            </p>
          ) : (
            <p className="pf-muted" style={{ fontSize: "0.8rem" }}>
              Uses your YouTube Data API key + Google Gemini (native YouTube
              transcripts, zero extra keys).
            </p>
          )}
        </div>
        {error && <div className="pf-error">{error}</div>}
      </form>

      {activeRunId && (
        <IngestionStepper
          db={db}
          runId={activeRunId}
          onCompleted={(channelId) => {
            setActiveRunId(null);
            void load();
            if (channelId) router.push(`/channels/${channelId}`);
          }}
        />
      )}

      {loading ? (
        <p className="pf-muted">Loading linked channels…</p>
      ) : channels.length === 0 ? (
        <div className="pf-card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
            No YouTube channels linked yet
          </h2>
          <p className="pf-muted" style={{ marginBottom: 0 }}>
            Paste any YouTube channel URL or @handle above to extract recent
            videos, outlier performance, comments, and transcripts into 16
            persistent Minds.
          </p>
        </div>
      ) : (
      <div className="pf-grid-2">
        {channels.map((ch) => (
          <article key={ch.id} className="pf-card">
            <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
              {ch.avatar_url && (
                <img
                  src={ch.avatar_url}
                  alt=""
                  width={48}
                  height={48}
                  style={{ borderRadius: "50%" }}
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{ch.title}</h2>
                <p className="pf-muted">
                  {ch.handle || "YouTube"} · {ch.primary_language.toUpperCase()}{" "}
                  · Median {ch.median_views.toLocaleString()} views
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "1rem",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span className="pf-badge pf-badge-ship">
                {ch.latestAudience
                  ? `${ch.latestAudience.activeMinds}/${ch.latestAudience.totalMinds} Minds Ready`
                  : "Pending"}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <a href={`/channels/${ch.id}`} className="pf-btn-ghost">
                  Inspect Minds
                </a>
                <a
                  href={`/studies/new?audienceId=${ch.latestAudience?.id || ""}`}
                  className="pf-btn-primary"
                >
                  New Study
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
      )}
    </>
  );
}

export default function ChannelsPage() {
  return (
    <AppShell>
      <ChannelsInner />
    </AppShell>
  );
}
