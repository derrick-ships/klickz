import type { MediatorRecord } from "@/lib/mediator";

/** Shows exactly what the image model received, apart from what the user wrote. */
export function MediatorDetails({ record }: { record: MediatorRecord }) {
  const e = record.enriched;
  return (
    <div className="mediator-details">
      {e.substantialChanges.length > 0 && (
        <div className="mediator-changes" role="note">
          <strong>Changed from what you wrote</strong>
          <ul>{e.substantialChanges.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      <dl>
        <dt>Idea</dt><dd>{e.concept}</dd>
        <dt>Text on the image</dt><dd>{e.imageText.length ? e.imageText.map((t) => `“${t}”`).join(" / ") : "None"}</dd>
        <dt>Panels</dt><dd>{e.panels}</dd>
        {e.decisions.length > 0 && <><dt>Decided for you</dt><dd><ul>{e.decisions.map((d) => <li key={d}>{d}</li>)}</ul></dd></>}
        <dt>Do</dt><dd><ul>{e.dos.map((d) => <li key={d.rule}>{d.rule}</li>)}</ul></dd>
        <dt>Don’t</dt><dd><ul>{e.donts.map((d) => <li key={d.rule}>{d.rule}</li>)}</ul></dd>
      </dl>
      <details className="mediator-sent">
        <summary>Exact prompt sent to the image model</summary>
        <pre>{record.imagePrompt}</pre>
        <small>Prepared by {record.provider} · {record.model} · {record.version} · {record.attempts} attempt{record.attempts === 1 ? "" : "s"}</small>
      </details>
    </div>
  );
}
