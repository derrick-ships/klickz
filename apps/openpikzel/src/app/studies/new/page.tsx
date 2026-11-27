"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, useAuthApi } from "@/components/nav/app-shell";
import { defaultDiagnosticQuestions } from "@/lib/default-questions";
import { estimateStudyCost } from "@/lib/study-cost";
import {
  extractOpening60s,
  type DiagnosticQuestion,
  type ProductionMode,
} from "@/lib/schemas/study";

type ChannelOption = {
  id: string;
  title: string;
  primary_language: string;
  latestAudience: {
    id: string;
    language: string;
    status: string;
    activeMinds: number;
    totalMinds: number;
  } | null;
};

type PersonaOption = {
  id: string;
  name: string;
  tone_of_voice?: string;
};

type MindRow = { id: string; active: boolean };

function StudyIntakeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { db, session, api } = useAuthApi();

  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedAudienceId, setSelectedAudienceId] = useState(
    params.get("audienceId") || "",
  );
  const [activeMindIds, setActiveMindIds] = useState<string[]>([]);
  const [language, setLanguage] = useState("en");
  const [personaId, setPersonaId] = useState("");
  const [productionMode, setProductionMode] = useState<ProductionMode | null>(
    null,
  );
  const [titleDraft, setTitleDraft] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [draftThumbnailPath, setDraftThumbnailPath] = useState<string | null>(
    null,
  );
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | null>(null);
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [questions, setQuestions] = useState<
    (DiagnosticQuestion & { enabled: boolean })[]
  >(() =>
    defaultDiagnosticQuestions("en").map((q) => ({ ...q, enabled: true })),
  );
  const [ccEmails, setCcEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    Promise.all([
      api<{ channels: ChannelOption[] }>("/api/channels"),
      api<{ personas: PersonaOption[] }>("/api/personas"),
    ])
      .then(([chRes, pRes]) => {
        const ready = (chRes.channels || []).filter(
          (c) => c.latestAudience?.status === "ready",
        );
        setChannels(ready);
        setPersonas(pRes.personas || []);
        if (!selectedAudienceId && ready[0]?.latestAudience?.id) {
          setSelectedAudienceId(ready[0].latestAudience.id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load setup."));
  }, [session, api, selectedAudienceId]);

  useEffect(() => {
    if (!db || !selectedAudienceId) return;
    const matched = channels.find(
      (c) => c.latestAudience?.id === selectedAudienceId,
    );
    const nextLang =
      matched?.latestAudience?.language || matched?.primary_language || "en";
    setLanguage(nextLang);
    setQuestions(
      defaultDiagnosticQuestions(nextLang).map((q) => ({ ...q, enabled: true })),
    );

    void db
      .from("audience_minds")
      .select("id,active")
      .eq("audience_id", selectedAudienceId)
      .order("sort_order", { ascending: true })
      .then((res) => {
        const ids = ((res.data || []) as MindRow[])
          .filter((m) => m.active)
          .map((m) => m.id)
          .slice(0, 16);
        setActiveMindIds(ids);
      });
  }, [db, selectedAudienceId, channels]);

  const enabledQuestions = useMemo(
    () => questions.filter((q) => q.enabled),
    [questions],
  );

  const cost = useMemo(
    () =>
      estimateStudyCost({
        mindsCount: activeMindIds.length || 16,
        questionsCount: enabledQuestions.length || 8,
        hasDraftThumbnail: !!draftThumbnailPath,
        scriptChars: scriptText.length,
      }),
    [
      activeMindIds.length,
      enabledQuestions.length,
      draftThumbnailPath,
      scriptText.length,
    ],
  );

  const openingPreview = useMemo(
    () => (scriptText.trim() ? extractOpening60s(scriptText) : ""),
    [scriptText],
  );

  async function handleDraftUpload(file: File | null) {
    if (!file || !db || !session) return;
    setUploadingDraft(true);
    setError("");
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${session.user.id}/study-drafts/${crypto.randomUUID()}.${ext}`;
      const up = await db.storage
        .from("studio-assets")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (up.error) throw up.error;
      setDraftThumbnailPath(path);
      setDraftPreviewUrl(URL.createObjectURL(file));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not upload draft thumbnail.",
      );
    } finally {
      setUploadingDraft(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedAudienceId) {
      setError("Select a connected YouTube channel audience first.");
      return;
    }
    if (activeMindIds.length < 12) {
      setError("Your channel audience needs at least 12 active Minds.");
      return;
    }
    if (!productionMode) {
      setError(
        "Choose a Production Mode (Pre-Shoot or Footage Locked) before launching.",
      );
      return;
    }
    if (enabledQuestions.length < 6 || enabledQuestions.length > 8) {
      setError("Keep between 6 and 8 diagnostic questions enabled.");
      return;
    }

    const notifyEmails = ccEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setBusy(true);
    try {
      const res = await api<{ studyId: string; runId: string }>(
        "/api/studies",
        "POST",
        {
          audienceId: selectedAudienceId,
          personaId: personaId || null,
          language,
          titleDraft: titleDraft.trim(),
          scriptText: scriptText.trim(),
          thumbnailPrompt: thumbnailPrompt.trim(),
          draftThumbnailPath,
          productionMode,
          diagnosticQuestions: enabledQuestions.map(({ enabled: _e, ...q }) => q),
          activeMindIds,
          notifyEmails,
        },
      );
      router.push(`/studies/${res.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch study.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="pf-header">
        <div>
          <h1>New Pre-Flight Packaging Study</h1>
          <p className="pf-muted">
            Runs asynchronously in the background (3–5 min). Close the tab after
            launching — we&apos;ll email your PDF, Markdown brief, and web report
            link straight to {session?.user.email}.
          </p>
        </div>
      </div>

      {/* 1. Channel Audience & Creator Persona */}
      <section className="pf-card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          1. Target Audience &amp; Creator Persona
        </h2>
        <div className="pf-grid-2">
          <div className="pf-field">
            <label htmlFor="audience-select">Channel Audience (12–16 Minds)</label>
            <select
              id="audience-select"
              className="pf-select"
              value={selectedAudienceId}
              onChange={(e) => setSelectedAudienceId(e.target.value)}
              required
            >
              <option value="">Select a connected channel…</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.latestAudience!.id}>
                  {ch.title} ({ch.latestAudience!.activeMinds} Minds ·{" "}
                  {ch.primary_language.toUpperCase()})
                </option>
              ))}
            </select>
            {channels.length === 0 && (
              <p className="pf-muted" style={{ fontSize: "0.8rem" }}>
                No ready channels yet —{" "}
                <a href="/channels">connect a YouTube channel first</a>.
              </p>
            )}
          </div>

          <div className="pf-field">
            <label htmlFor="persona-select">Creator Persona (Optional)</label>
            <select
              id="persona-select"
              className="pf-select"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">No face persona (topic/symbolic thumbnails)</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 2. Mandatory Production Mode */}
      <section className="pf-card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          2. Production Constraint (Required)
        </h2>
        <div className="pf-mode-grid">
          <button
            type="button"
            className="pf-mode-option"
            data-selected={productionMode === "pre_shoot"}
            onClick={() => setProductionMode("pre_shoot")}
          >
            <div style={{ marginBottom: "0.35rem" }}>
              <span className="pf-badge pf-badge-ship">pre_shoot</span>
            </div>
            <strong>Pre-Shoot (Angle &amp; Script Rewrite Allowed)</strong>
            <p className="pf-muted" style={{ marginTop: "0.35rem" }}>
              Outputs a sharper angle thesis, verbatim rewritten opening 60s
              hook, and structural pacing fixes before you film.
            </p>
          </button>

          <button
            type="button"
            className="pf-mode-option"
            data-selected={productionMode === "footage_locked"}
            onClick={() => setProductionMode("footage_locked")}
          >
            <div style={{ marginBottom: "0.35rem" }}>
              <span className="pf-badge pf-badge-iterate">footage_locked</span>
            </div>
            <strong>Footage Locked (Zero Reshoots)</strong>
            <p className="pf-muted" style={{ marginTop: "0.35rem" }}>
              Strictly forbids unfilmed claims. Outputs an exact Cold-Open Pull
              Quote for your editor + 3 zero-reshoot packaging pivots.
            </p>
          </button>
        </div>
      </section>

      {/* 3. Video Script, Title & Packaging */}
      <section className="pf-card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          3. Script, Draft Title &amp; Thumbnail Direction
        </h2>
        <div className="pf-field">
          <label htmlFor="title-draft">Draft Title</label>
          <input
            id="title-draft"
            className="pf-input"
            maxLength={160}
            required
            placeholder="Your current working YouTube title…"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
          />
        </div>

        <div className="pf-field">
          <label htmlFor="script-text">
            Full Script or Transcript (used in full by Leg C; opening ~60s shown
            to Minds in Pass 1)
          </label>
          <textarea
            id="script-text"
            className="pf-textarea"
            style={{ minHeight: 200 }}
            required
            minLength={40}
            placeholder="Paste your full video script or rough transcript here…"
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
          />
          {openingPreview && (
            <details style={{ marginTop: "0.35rem" }}>
              <summary className="pf-muted" style={{ cursor: "pointer", fontSize: "0.82rem" }}>
                Preview Opening 60s excerpt sent to 16 Minds (~170 words)
              </summary>
              <blockquote className="pf-quote" style={{ fontSize: "0.82rem" }}>
                {openingPreview}
              </blockquote>
            </details>
          )}
        </div>

        <div className="pf-grid-2">
          <div className="pf-field">
            <label htmlFor="thumb-prompt">
              Thumbnail Idea / Prompt (optional if uploading a draft)
            </label>
            <textarea
              id="thumb-prompt"
              className="pf-textarea"
              placeholder="Describe visual elements, quoted on-image words, or mood…"
              value={thumbnailPrompt}
              onChange={(e) => setThumbnailPrompt(e.target.value)}
            />
          </div>

          <div className="pf-field">
            <label htmlFor="draft-thumb">
              Upload Your Draft Thumbnail (Optional — Head-to-Head as Option A)
            </label>
            <input
              id="draft-thumb"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="pf-input"
              disabled={uploadingDraft}
              onChange={(e) =>
                void handleDraftUpload(e.target.files?.[0] ?? null)
              }
            />
            {draftThumbnailPath ? (
              <div style={{ marginTop: "0.5rem" }}>
                <span className="pf-badge pf-badge-ship">
                  Competing Head-to-Head as Option A vs. 2 AI Challengers
                </span>
                {draftPreviewUrl && (
                  <div className="pf-thumb-wrap" style={{ marginTop: "0.5rem" }}>
                    <img src={draftPreviewUrl} alt="Uploaded draft thumbnail" />
                  </div>
                )}
                <button
                  type="button"
                  className="pf-btn-ghost"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => {
                    setDraftThumbnailPath(null);
                    setDraftPreviewUrl(null);
                  }}
                >
                  Remove Draft (Generate 3 Fresh AI Options)
                </button>
              </div>
            ) : (
              <p className="pf-muted" style={{ fontSize: "0.8rem" }}>
                Leave empty to generate 3 brand-new AI packaging options (A, B,
                C). Upload your draft to test it directly as Option A against 2
                AI challengers.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 4. Editable Diagnostic Question Set (6-8) */}
      <section className="pf-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
            4. Diagnostic Question Set ({enabledQuestions.length}/8 active · min
            6)
          </h2>
          <span className="pf-badge pf-badge-neutral">
            Language: {language.toUpperCase()}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {questions.map((q, idx) => (
            <div
              key={q.id}
              style={{
                display: "flex",
                gap: "0.6rem",
                alignItems: "center",
                opacity: q.enabled ? 1 : 0.45,
              }}
            >
              <input
                type="checkbox"
                checked={q.enabled}
                disabled={q.locked || (q.enabled && enabledQuestions.length <= 6)}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, enabled: e.target.checked } : item,
                    ),
                  )
                }
              />
              <input
                className="pf-input"
                value={q.prompt}
                disabled={q.locked}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, prompt: e.target.value } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* 5. Automatic Email Delivery */}
      <section className="pf-card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          5. Automatic Email Delivery (PDF + Markdown + Web Link)
        </h2>
        <div className="pf-field" style={{ marginBottom: 0 }}>
          <label htmlFor="cc-emails">
            Also send finished report to (optional — editor / designer emails,
            comma-separated)
          </label>
          <input
            id="cc-emails"
            className="pf-input"
            placeholder="editor@studio.com, designer@studio.com"
            value={ccEmails}
            onChange={(e) => setCcEmails(e.target.value)}
          />
          <p className="pf-muted" style={{ fontSize: "0.8rem" }}>
            Your account email ({session?.user.email}) always receives the PDF,
            Markdown (.md), and unlisted link automatically.
          </p>
        </div>
      </section>

      {error && <div className="pf-error">{error}</div>}

      {/* Sticky Cost Readout & Launch */}
      <div className="pf-sticky-bar">
        <div>
          <strong style={{ display: "block", fontSize: "0.95rem" }}>
            {cost.summary}
          </strong>
          <span className="pf-muted" style={{ fontSize: "0.8rem" }}>
            Billed directly to your connected AI keys · Runs safely even if you
            close your browser.
          </span>
        </div>
        <button
          type="submit"
          className="pf-btn-primary"
          disabled={busy || uploadingDraft}
        >
          {busy ? "Launching Study…" : "Confirm & Launch Pre-Flight Study"}
        </button>
      </div>
    </form>
  );
}

export default function NewStudyPage() {
  return (
    <AppShell>
      <StudyIntakeInner />
    </AppShell>
  );
}
