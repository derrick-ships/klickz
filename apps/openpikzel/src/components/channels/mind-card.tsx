"use client";
import { useState } from "react";
import type { PersistedMind } from "@/lib/schemas/audience";

const ARCHETYPE_LABELS: Record<PersistedMind["archetype"], string> = {
  loyalist: "Loyalist",
  casual_scroller: "Casual Scroller",
  skeptic: "Skeptic",
  new_viewer: "New Viewer",
};

export function MindCard({
  mind,
  canDeactivate,
  onSave,
}: {
  mind: PersistedMind;
  canDeactivate: boolean;
  onSave: (patch: {
    mindId: string;
    active?: boolean;
    role?: string;
    click_bar?: number;
    skepticism_triggers?: string[];
  }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(mind.role);
  const [clickBar, setClickBar] = useState(mind.click_bar);
  const [triggers, setTriggers] = useState(mind.skepticism_triggers.join("\n"));
  const [busy, setBusy] = useState(false);

  const initials = mind.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  async function saveEdits() {
    setBusy(true);
    try {
      await onSave({
        mindId: mind.id,
        role: role.trim(),
        click_bar: clickBar,
        skepticism_triggers: triggers
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="pf-card"
      style={{ opacity: mind.active ? 1 : 0.55 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#262632",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: "0.85rem",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <strong>{mind.name}</strong>
            <div className="pf-muted" style={{ fontSize: "0.8rem" }}>
              {mind.age_bracket} · Click bar {mind.click_bar}/10
            </div>
          </div>
        </div>
        <span
          className={
            mind.archetype === "skeptic"
              ? "pf-badge pf-badge-rethink"
              : "pf-badge pf-badge-neutral"
          }
        >
          {ARCHETYPE_LABELS[mind.archetype]}
        </span>
      </div>

      <p style={{ fontSize: "0.88rem", margin: "0.65rem 0 0.5rem" }}>
        {mind.role}
      </p>

      <blockquote className="pf-quote" style={{ fontSize: "0.82rem" }}>
        &ldquo;{mind.sample_voice_quote}&rdquo;
      </blockquote>

      <div style={{ fontSize: "0.82rem", marginTop: "0.65rem" }}>
        <strong>Skepticism Triggers:</strong>
        <ul style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.1rem", color: "#d4d4d8" }}>
          {mind.skepticism_triggers.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      <details style={{ fontSize: "0.82rem", color: "#a1a1aa" }}>
        <summary style={{ cursor: "pointer" }}>
          Knowledge &amp; Thinking Patterns
        </summary>
        <ul style={{ margin: "0.35rem 0", paddingLeft: "1.1rem" }}>
          {mind.knowledge_items.map((k, i) => (
            <li key={`k-${i}`}>{k}</li>
          ))}
          {mind.thinking_patterns.map((p, i) => (
            <li key={`p-${i}`}>{p}</li>
          ))}
        </ul>
      </details>

      {editing ? (
        <div style={{ marginTop: "0.75rem", borderTop: "1px solid #24242c", paddingTop: "0.75rem" }}>
          <div className="pf-field">
            <label>Role</label>
            <input
              className="pf-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div className="pf-field">
            <label>Click Threshold (1-10): {clickBar}</label>
            <input
              type="range"
              min={1}
              max={10}
              value={clickBar}
              onChange={(e) => setClickBar(Number(e.target.value))}
            />
          </div>
          <div className="pf-field">
            <label>Skepticism Triggers (one per line)</label>
            <textarea
              className="pf-textarea"
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="pf-btn-primary"
              disabled={busy}
              onClick={() => void saveEdits()}
            >
              Save
            </button>
            <button
              type="button"
              className="pf-btn-ghost"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            className="pf-btn-ghost"
            onClick={() => setEditing(true)}
          >
            Edit Mind
          </button>
          <button
            type="button"
            className="pf-btn-ghost"
            disabled={busy || (mind.active && !canDeactivate)}
            onClick={() => {
              setBusy(true);
              void onSave({ mindId: mind.id, active: !mind.active }).finally(
                () => setBusy(false),
              );
            }}
          >
            {mind.active ? "Disable" : "Enable"}
          </button>
        </div>
      )}
    </article>
  );
}
