"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useAuthApi } from "@/components/nav/app-shell";

type CreatorPersona = {
  id: string;
  name: string;
  notes: string;
  refs: string[];
  profile_status?: "draft" | "ready";
  identity_brief?: string;
  tone_of_voice?: string;
  visual_style_rules?: string;
};

function PersonasInner() {
  const { session, api } = useAuthApi();
  const [personas, setPersonas] = useState<CreatorPersona[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tone, setTone] = useState("");
  const [visualRules, setVisualRules] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{
      personas: CreatorPersona[];
      imageUrls: Record<string, string>;
    }>("/api/personas");
    setPersonas(res.personas || []);
    setImageUrls(res.imageUrls || {});
  }, [api]);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (userId) void load().catch((e) => setError(e.message));
  }, [userId, load]);

  async function saveRules(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/personas", "PATCH", {
        id,
        tone_of_voice: tone,
        visual_style_rules: visualRules,
        notes,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save rules.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pf-header">
        <div>
          <h1>Creator Personas</h1>
          <p className="pf-muted">
            Manage face references, visual style rules, and tone of voice injected
            into Leg A thumbnail renders and Leg C hook rewrites.
          </p>
        </div>
        <a href="/studio" className="pf-btn-primary">
          + Upload Face Photos in Quick Studio
        </a>
      </div>

      {error && <div className="pf-error">{error}</div>}

      {personas.length === 0 ? (
        <div className="pf-card">
          <h2 style={{ marginTop: 0 }}>No Creator Personas yet</h2>
          <p className="pf-muted" style={{ marginBottom: "1rem" }}>
            Upload 2–3 clear photos of the creator in Quick Studio (People) so
            MediaPipe face-validation checks them, then configure their Tone of
            Voice and Visual Style Rules here.
          </p>
          <a href="/studio" className="pf-btn-primary">
            Open Quick Studio → People
          </a>
        </div>
      ) : (
        <div className="pf-grid-2">
          {personas.map((p) => (
            <article key={p.id} className="pf-card">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  {(p.refs || []).slice(0, 3).map((ref) =>
                    imageUrls[ref] ? (
                      <img
                        key={ref}
                        src={imageUrls[ref]}
                        alt={p.name}
                        width={52}
                        height={52}
                        style={{
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #2b2b35",
                        }}
                      />
                    ) : null,
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{p.name}</h2>
                  <span className="pf-badge pf-badge-neutral">
                    {p.profile_status === "ready" ? "Identity Prepared" : `${p.refs.length} Face Refs`}
                  </span>
                </div>
              </div>

              {editingId === p.id ? (
                <div>
                  <div className="pf-field">
                    <label>Tone of Voice (used for Titles &amp; Hook Rewrites)</label>
                    <textarea
                      className="pf-textarea"
                      placeholder="e.g., Direct investigative tone, zero clickbait hype, sharp dry humor…"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                    />
                  </div>
                  <div className="pf-field">
                    <label>Visual Style Rules (used for Thumbnail Generation)</label>
                    <textarea
                      className="pf-textarea"
                      placeholder="e.g., Rembrandt side lighting, teal/amber high contrast, max 3 uppercase words…"
                      value={visualRules}
                      onChange={(e) => setVisualRules(e.target.value)}
                    />
                  </div>
                  <div className="pf-field">
                    <label>Identity Notes (Studio reference notes)</label>
                    <textarea
                      className="pf-textarea"
                      placeholder="Optional likeness or expression notes imported from Quick Studio…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="pf-btn-primary"
                      disabled={busy}
                      onClick={() => void saveRules(p.id)}
                    >
                      {busy ? "Saving…" : "Save Persona Rules"}
                    </button>
                    <button
                      type="button"
                      className="pf-btn-ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "0.86rem", marginBottom: "0.5rem" }}>
                    <strong>Tone of Voice:</strong>{" "}
                    <span className="pf-muted">
                      {p.tone_of_voice || "Not configured yet"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.86rem", marginBottom: "0.5rem" }}>
                    <strong>Visual Style Rules:</strong>{" "}
                    <span className="pf-muted">
                      {p.visual_style_rules || "Not configured yet"}
                    </span>
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: "0.84rem", marginBottom: "0.85rem" }}>
                      <strong>Identity Notes:</strong>{" "}
                      <span className="pf-muted">{p.notes}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="pf-btn-ghost"
                    onClick={() => {
                      setEditingId(p.id);
                      setTone(p.tone_of_voice || "");
                      setVisualRules(p.visual_style_rules || "");
                      setNotes(p.notes || "");
                    }}
                  >
                    Edit Persona Rules
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default function PersonasPage() {
  return (
    <AppShell>
      <PersonasInner />
    </AppShell>
  );
}
