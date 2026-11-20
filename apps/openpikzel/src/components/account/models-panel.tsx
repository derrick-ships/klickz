"use client";
import { useEffect, useState } from "react";
import { textChoices } from "@/lib/model-choice";

type Models = { reviewer: string; scorer: "jev" | "model"; mediator: string; image: string };
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
type Connected = { openai: boolean; google: boolean; anthropic: boolean; jev: boolean };

const imageChoices = [
  { id: "flare", label: "GPT Image Flare" },
  { id: "sunburst", label: "GPT Image Sunburst" },
  { id: "gemini-flash", label: "Gemini Flash Image" },
  { id: "gemini-pro", label: "Gemini Pro Image" },
];

/** Settings → Models: which model does each job. */
export function ModelsPanel({ api, connected }: { api: Api; connected: Connected }) {
  const [models, setModels] = useState<Models | null>(null);
  const [resolved, setResolved] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    let live = true;
    api("/api/models").then((r) => {
      if (!live) return;
      // A stored "auto" for the prompt writer is GPT Sol now; keep the state on the real value so
      // saving another field never writes "auto" back.
      setModels({
        ...r.models,
        mediator: ["auto", "gpt-sol-latest"].includes(r.models.mediator) ? "gpt-6.2-sol" : r.models.mediator,
        // Same rule as the stored-preference reader: an "auto" reviewer is Claude Sonnet now.
        reviewer: r.models.reviewer === "auto" ? "sonnet-latest" : r.models.reviewer,
      });
      setResolved(r.resolved || {});
    }).catch(() => live && setStatus("Couldn’t load models."));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(next: Models) {
    const previous = models;
    setModels(next);
    setStatus("Saving…");
    try { await api("/api/models", "PUT", next); setStatus("Saved"); }
    catch (e) { setModels(previous); setStatus(e instanceof Error ? e.message : "Couldn’t save."); }
  }

  const option = (id: string, label: string, provider: keyof Connected) => (
    <option key={id} value={id} disabled={!connected[provider]}>
      {label}{connected[provider] ? (resolved[id] ? ` · ${resolved[id]}` : "") : " · not connected"}
    </option>
  );

  if (!models) return <section id="models" className="account-panel"><h2>Models</h2><p role="status">{status || "Loading…"}</p></section>;
  return (
    <section id="models" className="account-panel models-panel">
      <h2>Models</h2>
      <div className="models-grid">
      <label htmlFor="model-reviewer">Reviewer</label>
        <select id="model-reviewer" value={models.reviewer} onChange={(e) => void save({ ...models, reviewer: e.target.value })}>
          {textChoices.map((c) => option(c.id, c.label, c.provider))}
        </select>
      <label htmlFor="model-scorer">Scorer</label>
        <select id="model-scorer" value={models.scorer} onChange={(e) => void save({ ...models, scorer: e.target.value as Models["scorer"] })}>
          <option value="jev" disabled={!connected.jev}>Scoring AI{connected.jev ? "" : " · not connected"}</option>
          <option value="model">Reviewer</option>
        </select>
      <label htmlFor="model-mediator">Prompt writer</label>
        <select id="model-mediator" value={models.mediator} onChange={(e) => void save({ ...models, mediator: e.target.value })}>
          {textChoices.filter((c) => c.provider !== "anthropic").map((c) => option(c.id, c.label, c.provider))}
        </select>
      <label htmlFor="model-image">Image</label>
        <select id="model-image" value={models.image} onChange={(e) => void save({ ...models, image: e.target.value })}>
          {imageChoices.map((c) => <option key={c.id} value={c.id} disabled={c.id.startsWith("gemini") ? !connected.google : !connected.openai}>{c.label}</option>)}
        </select>
      </div>
      <p className="models-status" role="status">{status}</p>
    </section>
  );
}
