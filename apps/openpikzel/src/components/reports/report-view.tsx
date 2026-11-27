"use client";
import { useMemo, useState } from "react";
import { AnalysisPanel } from "@/components/creative/analysis";
import { ScoreBadge } from "@/components/creative/score-badge";
import { ReviewCanvas } from "@/components/review-canvas";
import { useAuthApi } from "@/components/nav/app-shell";
import type { MindArchetype } from "@/lib/schemas/audience";
import type { ReportPayload } from "@/lib/schemas/study";

export function ExecutiveReportView({
  slug,
  report,
  initialIsPublic,
  ownerUserId,
  signedImageUrls,
}: {
  slug: string;
  report: ReportPayload;
  initialIsPublic: boolean;
  ownerUserId: string;
  signedImageUrls: Partial<Record<"A" | "B" | "C", string>>;
}) {
  const { session, api } = useAuthApi();
  const isOwner = session?.user.id === ownerUserId;
  const es = report.language.toLowerCase().startsWith("es");

  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [copied, setCopied] = useState(false);
  const [archetypeFilter, setArchetypeFilter] = useState<"all" | MindArchetype>(
    "all",
  );
  const [voteFilter, setVoteFilter] = useState<
    "all" | "A" | "B" | "C" | "none_keep_scrolling"
  >("all");
  const [feedPreviewKey, setFeedPreviewKey] = useState<"A" | "B" | "C" | null>(
    null,
  );
  const [busyToggle, setBusyToggle] = useState(false);

  const filteredMinds = useMemo(
    () =>
      report.voiceOfMinds.filter((m) => {
        if (archetypeFilter !== "all" && m.archetype !== archetypeFilter)
          return false;
        if (voteFilter !== "all" && m.chosenOption !== voteFilter) return false;
        return true;
      }),
    [report.voiceOfMinds, archetypeFilter, voteFilter],
  );

  const verdictBadgeClass =
    report.verdict.code === "SHIP"
      ? "pf-badge pf-badge-ship"
      : report.verdict.code === "ITERATE"
        ? "pf-badge pf-badge-iterate"
        : "pf-badge pf-badge-rethink";

  async function togglePublic() {
    setBusyToggle(true);
    try {
      const res = await api<{ report: { is_public: boolean } }>(
        `/api/reports/${slug}/visibility`,
        "PATCH",
        { isPublic: !isPublic },
      );
      setIsPublic(res.report.is_public);
    } finally {
      setBusyToggle(false);
    }
  }

  return (
    <div className="pf-shell">
      <header className="pf-nav pf-no-print">
        <a href="/" className="pf-nav-brand">
          <span className="pf-nav-dot" aria-hidden="true" />
          OpenPikzels · {es ? "Reporte Pre-Vuelo" : "Pre-Flight Report"}
        </a>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="pf-btn-ghost"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Link Copied" : "Copy Share Link"}
          </button>
          <a
            href={`/api/reports/${slug}/download?format=pdf`}
            className="pf-btn-ghost"
          >
            Download PDF
          </a>
          <a
            href={`/api/reports/${slug}/download?format=md`}
            className="pf-btn-ghost"
          >
            Download .MD
          </a>
          <button
            type="button"
            className="pf-btn-ghost"
            onClick={() => window.print()}
          >
            Print View
          </button>
          {isOwner && (
            <button
              type="button"
              className="pf-btn-ghost"
              disabled={busyToggle}
              onClick={() => void togglePublic()}
            >
              {isPublic ? "Link: Unlisted Public" : "Link: Private Only"}
            </button>
          )}
        </div>
      </header>

      <main className="pf-main">
        {/* SECTION 1: EXECUTIVE VERDICT */}
        <section className="pf-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "0.5rem",
            }}
          >
            <span className={verdictBadgeClass}>{report.verdict.code}</span>
            <span className="pf-badge pf-badge-neutral">
              {report.productionMode === "pre_shoot"
                ? es
                  ? "Pre-Grabación"
                  : "Pre-Shoot"
                : es
                  ? "Material Cerrado (Cero Regrabación)"
                  : "Footage Locked (Zero Reshoots)"}
            </span>
            <span className="pf-muted">
              {report.channelTitle} · {report.totalMindsResponded} Minds (
              {report.totalSyntheticResponses}{" "}
              {es ? "respuestas" : "synthetic responses"})
            </span>
          </div>

          <h1 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.6rem" }}>
            {report.studyTitleDraft}
          </h1>
          <p style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 1rem" }}>
            {report.verdict.headline}
          </p>

          {/* Click Share Bar */}
          <div className="pf-grid-2" style={{ marginBottom: "1rem" }}>
            <div className="pf-card" style={{ background: "#0e0e13" }}>
              <strong style={{ fontSize: "0.9rem" }}>
                {es ? "Cuota de Clics Simulada (16 Mentes)" : "Simulated Click Share"}
              </strong>
              <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {(["A", "B", "C", "none_keep_scrolling"] as const).map((k) => {
                  const s = report.verdict.clickShare[k];
                  const label =
                    k === "none_keep_scrolling"
                      ? es
                        ? "Seguiría de largo (Skip)"
                        : "Kept Scrolling (Skip)"
                      : `Option ${k}`;
                  return (
                    <div key={k} style={{ fontSize: "0.86rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{label}</span>
                        <strong>
                          {s.pct}% ({s.count})
                        </strong>
                      </div>
                      <div className="pf-progress-bar" style={{ margin: "0.2rem 0 0", height: 6 }}>
                        <div
                          className="pf-progress-fill"
                          style={{
                            width: `${s.pct}%`,
                            background:
                              k === "none_keep_scrolling"
                                ? "#71717a"
                                : report.verdict.winningOptionKey === k
                                  ? "#10b981"
                                  : "#e11d48",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pf-card" style={{ background: "#0e0e13" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong style={{ fontSize: "0.9rem" }}>
                  {es ? "Alerta de Caída de Retención" : "Retention Cliff Warning"}
                </strong>
                <span
                  className={
                    report.verdict.retentionCliff.severity === "high"
                      ? "pf-badge pf-badge-rethink"
                      : report.verdict.retentionCliff.severity === "medium"
                        ? "pf-badge pf-badge-iterate"
                        : "pf-badge pf-badge-ship"
                  }
                >
                  {report.verdict.retentionCliff.severity}
                </span>
              </div>
              <p style={{ fontSize: "0.88rem", marginTop: "0.5rem" }}>
                {report.verdict.retentionCliff.summary}
              </p>
              {report.verdict.retentionCliff.exact_drop_point_quote && (
                <blockquote className="pf-quote" style={{ fontSize: "0.84rem" }}>
                  &ldquo;{report.verdict.retentionCliff.exact_drop_point_quote}&rdquo;
                </blockquote>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: ANGLE & SCRIPT DIAGNOSIS */}
        <section className="pf-card pf-print-break">
          <h2 style={{ marginTop: 0 }}>
            2. {es ? "Diagnóstico Editorial y de Guion" : "Angle & Script Diagnosis"}
          </h2>

          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
            {es
              ? "Ángulos de Alto Impacto Enterrados en el Guion"
              : "Buried High-Leverage Angles Found in Full Script"}
          </h3>
          <div className="pf-grid-2" style={{ marginBottom: "1.25rem" }}>
            {report.angleDiagnosis.buriedAngles.map((a, idx) => (
              <div key={idx} className="pf-card" style={{ background: "#0e0e13" }}>
                <strong>{a.angle_name}</strong>
                <p className="pf-muted" style={{ marginTop: "0.35rem" }}>
                  {a.why_high_leverage}
                </p>
                <blockquote className="pf-quote" style={{ fontSize: "0.84rem" }}>
                  &ldquo;{a.script_quote}&rdquo;
                </blockquote>
              </div>
            ))}
          </div>

          {report.productionMode === "pre_shoot" &&
            report.angleDiagnosis.preShootPlan && (
              <div className="pf-card" style={{ background: "#0e0e13", borderColor: "#10b981" }}>
                <h3 style={{ marginTop: 0 }}>
                  {es
                    ? "Pivote Propuesto y Reescritura del Gancho (Pre-Grabación)"
                    : "Proposed Angle & Opening 60s Hook Rewrite (Pre-Shoot)"}
                </h3>
                <p>
                  <strong>{es ? "Título Reescrito:" : "Rewritten Title:"}</strong>{" "}
                  {report.angleDiagnosis.preShootPlan.rewritten_title}
                </p>
                <p className="pf-muted">
                  {report.angleDiagnosis.preShootPlan.proposed_angle_thesis}
                </p>
                <blockquote className="pf-quote" style={{ whiteSpace: "pre-wrap" }}>
                  {report.angleDiagnosis.preShootPlan.rewritten_opening_60s_hook}
                </blockquote>
                <strong style={{ fontSize: "0.88rem" }}>
                  {es ? "Ajustes Estructurales:" : "Structural Pacing Fixes:"}
                </strong>
                <ul style={{ paddingLeft: "1.2rem", marginTop: "0.35rem" }}>
                  {report.angleDiagnosis.preShootPlan.structural_changes.map(
                    (c, i) => (
                      <li key={i}>{c}</li>
                    ),
                  )}
                </ul>
              </div>
            )}

          {report.productionMode === "footage_locked" &&
            report.angleDiagnosis.footageLockedPlan && (
              <div className="pf-card" style={{ background: "#0e0e13", borderColor: "#f59e0b" }}>
                <h3 style={{ marginTop: 0 }}>
                  {es
                    ? "Material Cerrado: Cita Cold-Open y 3 Pivotes Sin Regrabar"
                    : "Footage Locked: Cold-Open Pull Quote & 3 Zero-Reshoot Pivots"}
                </h3>
                <strong style={{ fontSize: "0.9rem" }}>
                  {es
                    ? "Cita Exacta para Mover a 0:00 (Editor):"
                    : "Cold-Open Pull Quote (Cut to 0:00):"}
                </strong>
                <blockquote className="pf-quote">
                  &ldquo;
                  {
                    report.angleDiagnosis.footageLockedPlan.cold_open_pull_quote
                      .verbatim_quote
                  }
                  &rdquo;
                </blockquote>
                <p style={{ fontSize: "0.88rem" }}>
                  <strong>{es ? "Instrucción de Corte:" : "Cut Instruction:"}</strong>{" "}
                  {
                    report.angleDiagnosis.footageLockedPlan.cold_open_pull_quote
                      .editor_cut_instruction
                  }
                </p>
                <ul style={{ paddingLeft: "1.2rem", fontSize: "0.86rem" }}>
                  {report.angleDiagnosis.footageLockedPlan.editor_cut_notes.map(
                    (n, i) => (
                      <li key={i}>{n}</li>
                    ),
                  )}
                </ul>

                <h4 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
                  {es
                    ? "3 Rutas de Empaque Sin Regrabar"
                    : "3 Zero-Reshoot Packaging Pivots"}
                </h4>
                <div className="pf-grid-3">
                  {report.angleDiagnosis.footageLockedPlan.zero_reshoot_pivots.map(
                    (piv, i) => (
                      <div key={i} className="pf-card" style={{ padding: "0.85rem" }}>
                        <span className="pf-badge pf-badge-neutral">
                          {piv.target_emotion}
                        </span>
                        <h5 style={{ margin: "0.4rem 0 0.25rem" }}>
                          {piv.route_name}
                        </h5>
                        <p style={{ fontWeight: 600, fontSize: "0.88rem", margin: "0 0 0.35rem" }}>
                          {piv.new_title}
                        </p>
                        <p className="pf-muted" style={{ fontSize: "0.82rem" }}>
                          {piv.visual_frame_instruction}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
        </section>

        {/* SECTION 3: SIDE-BY-SIDE PACKAGING MATRIX */}
        <section className="pf-card pf-print-break">
          <h2 style={{ marginTop: 0 }}>
            3. {es ? "Matriz de Empaque y Notas de Diseño" : "Side-by-Side Packaging Matrix"}
          </h2>

          <div className="pf-grid-3">
            {report.packagingMatrix.map((opt) => {
              const imgUrl = signedImageUrls[opt.optionKey];
              const isWinner =
                report.verdict.winningOptionKey === opt.optionKey;
              return (
                <article
                  key={opt.optionKey}
                  className="pf-card"
                  style={{
                    background: "#0e0e13",
                    borderColor: isWinner ? "#10b981" : "#262630",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.4rem",
                      marginBottom: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className={isWinner ? "pf-badge pf-badge-ship" : "pf-badge pf-badge-neutral"}>
                      Option {opt.optionKey}
                      {opt.isUserDraft ? " · Draft" : ""}
                      {isWinner ? " ★ Winner" : ""}
                    </span>
                    <span className="pf-badge pf-badge-neutral">
                      {opt.voteSharePct}% ({opt.voteCount} votes)
                    </span>
                  </div>

                  {imgUrl && (
                    <div className="pf-thumb-wrap" style={{ marginBottom: "0.65rem" }}>
                      <img src={imgUrl} alt={opt.title} />
                      {opt.klickzScore && (
                        <ScoreBadge score={opt.klickzScore} />
                      )}
                    </div>
                  )}

                  <h3 style={{ fontSize: "1rem", margin: "0 0 0.25rem" }}>
                    {opt.title}
                  </h3>
                  <p className="pf-muted" style={{ fontSize: "0.82rem", marginBottom: "0.65rem" }}>
                    {opt.angleLabel} · {opt.visualRationale}
                  </p>

                  {opt.designerRedline && (
                    <div
                      style={{
                        borderTop: "1px solid #24242c",
                        paddingTop: "0.65rem",
                        fontSize: "0.84rem",
                      }}
                    >
                      <strong style={{ color: "#fb7185" }}>
                        {es ? "Redline Diseñador:" : "Designer Redline:"}
                      </strong>
                      <p style={{ margin: "0.25rem 0 0.45rem" }}>
                        {opt.designerRedline.primaryFix}
                      </p>
                      {opt.designerRedline.keep.length > 0 && (
                        <p className="pf-muted" style={{ fontSize: "0.78rem" }}>
                          <strong>{es ? "Mantener:" : "Keep:"}</strong>{" "}
                          {opt.designerRedline.keep.join("; ")}
                        </p>
                      )}
                    </div>
                  )}

                  <div
                    className="pf-no-print"
                    style={{
                      display: "flex",
                      gap: "0.45rem",
                      marginTop: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {imgUrl && (
                      <>
                        <button
                          type="button"
                          className="pf-btn-ghost"
                          onClick={() =>
                            setFeedPreviewKey(
                              feedPreviewKey === opt.optionKey
                                ? null
                                : opt.optionKey,
                            )
                          }
                        >
                          {feedPreviewKey === opt.optionKey
                            ? "Hide Feed Test"
                            : "Feed / Squint Test"}
                        </button>
                        <a
                          href={imgUrl}
                          download={`option-${opt.optionKey}.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pf-btn-ghost"
                        >
                          Download Image
                        </a>
                      </>
                    )}
                  </div>

                  {feedPreviewKey === opt.optionKey && imgUrl && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <ReviewCanvas
                        src={imgUrl}
                        title={opt.title}
                        feed={true}
                        portrait={false}
                        onRefresh={async () => {}}
                        creationId={`${slug}-${opt.optionKey}`}
                        arrival={null}
                        uploaded={true}
                      />
                    </div>
                  )}

                  {opt.klickzScore && (
                    <details style={{ marginTop: "0.65rem" }}>
                      <summary className="pf-muted" style={{ cursor: "pointer", fontSize: "0.82rem" }}>
                        5-Pillar Klickz Score Breakdown (
                        {opt.klickzScore.overall ?? "–"}/100)
                      </summary>
                      <div style={{ marginTop: "0.5rem" }}>
                        <AnalysisPanel
                          score={opt.klickzScore}
                          busy={false}
                          onFix={() => {}}
                          readOnly={true}
                        />
                      </div>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: VOICE OF THE MINDS */}
        <section className="pf-card pf-print-break">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ margin: 0 }}>
              4. {es ? "Voz de las Mentes" : "Voice of the Minds"} (
              {filteredMinds.length}/{report.voiceOfMinds.length})
            </h2>
            <div className="pf-chip-row pf-no-print">
              {(["all", "loyalist", "casual_scroller", "skeptic", "new_viewer"] as const).map(
                (a) => (
                  <button
                    key={a}
                    type="button"
                    className="pf-chip"
                    data-active={archetypeFilter === a}
                    onClick={() => setArchetypeFilter(a)}
                  >
                    {a === "all" ? "All Profiles" : a.replace("_", " ")}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="pf-chip-row pf-no-print" style={{ marginBottom: "1rem" }}>
            {(["all", "A", "B", "C", "none_keep_scrolling"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="pf-chip"
                data-active={voteFilter === v}
                onClick={() => setVoteFilter(v)}
              >
                {v === "all"
                  ? "All Votes"
                  : v === "none_keep_scrolling"
                    ? "Kept Scrolling"
                    : `Voted ${v}`}
              </button>
            ))}
          </div>

          <div className="pf-grid-2">
            {filteredMinds.map((m) => {
              const voteLabel =
                m.chosenOption === "none_keep_scrolling"
                  ? es
                    ? "Seguir de largo"
                    : "Kept Scrolling"
                  : `Option ${m.chosenOption}`;
              return (
                <article
                  key={m.mindId}
                  className="pf-card"
                  style={{ background: "#0e0e13" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <strong>{m.name}</strong>
                      <div className="pf-muted" style={{ fontSize: "0.8rem" }}>
                        {m.role} · {m.archetype.replace("_", " ")}
                      </div>
                    </div>
                    <span
                      className={
                        m.chosenOption === "none_keep_scrolling"
                          ? "pf-badge pf-badge-rethink"
                          : "pf-badge pf-badge-ship"
                      }
                    >
                      {voteLabel} ({m.clickConfidence}/10)
                    </span>
                  </div>

                  <p style={{ fontSize: "0.88rem", margin: "0.65rem 0 0.45rem" }}>
                    {m.verbatimClickReason}
                  </p>

                  <p style={{ fontSize: "0.84rem", margin: "0 0 0.45rem" }}>
                    <strong style={{ color: "#fbbf24" }}>
                      {es ? "Freno Principal:" : "Hesitation Killer:"}
                    </strong>{" "}
                    {m.topHesitationKiller}
                  </p>

                  {m.commentSkepticismQuote && (
                    <blockquote className="pf-quote" style={{ fontSize: "0.82rem" }}>
                      <strong>{es ? "Comentario (Pass 2):" : "Comment (Pass 2):"}</strong>{" "}
                      &ldquo;{m.commentSkepticismQuote}&rdquo;
                    </blockquote>
                  )}

                  {m.questionAnswers.length > 0 && (
                    <details style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>
                      <summary className="pf-muted" style={{ cursor: "pointer" }}>
                        Full Diagnostic Q&amp;A ({m.questionAnswers.length})
                      </summary>
                      <dl style={{ marginTop: "0.45rem" }}>
                        {m.questionAnswers.map((qa) => {
                          const qDef = report.diagnosticQuestions.find(
                            (q) => q.id === qa.question_id,
                          );
                          return (
                            <div key={qa.question_id} style={{ marginBottom: "0.45rem" }}>
                              <dt style={{ fontWeight: 600, color: "#d4d4d8" }}>
                                {qDef?.prompt || qa.question_id} ({qa.score_1_to_10}
                                /10)
                              </dt>
                              <dd style={{ margin: "0.15rem 0 0", color: "#a1a1aa" }}>
                                {qa.answer}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
