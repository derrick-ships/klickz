import type { ReportPayload } from "../schemas/study";

/**
 * Deterministic Markdown Executive Brief serializer (UTF-8, bilingual EN/ES labels).
 * Designed to drop straight into Notion, Obsidian, Slack, or editor briefs.
 */
export function renderReportMarkdown(
  report: ReportPayload,
  reportUrl: string,
): string {
  const es = report.language.toLowerCase().startsWith("es");
  const lines: string[] = [];

  lines.push(
    `# ${es ? "Reporte Ejecutivo Pre-Vuelo" : "Executive Pre-Flight Report"}: ${report.studyTitleDraft}`,
  );
  lines.push("");
  lines.push(
    `- **${es ? "Canal" : "Channel"}:** ${report.channelTitle}${report.channelHandle ? ` (${report.channelHandle})` : ""}`,
  );
  lines.push(
    `- **${es ? "Modo de Producción" : "Production Mode"}:** \`${report.productionMode}\` (${report.productionMode === "pre_shoot" ? (es ? "Pre-grabación — cambios de guion permitidos" : "Pre-Shoot — script & angle rewrites allowed") : es ? "Material cerrado — cero regrabaciones" : "Footage Locked — zero reshoots"})`,
  );
  lines.push(
    `- **${es ? "Muestra Simulada" : "Simulated Sample"}:** ${report.totalMindsResponded} Minds × ${report.diagnosticQuestions.length} ${es ? "preguntas" : "questions"} = **${report.totalSyntheticResponses} ${es ? "respuestas sintéticas" : "synthetic responses"}**`,
  );
  lines.push(
    `- **${es ? "Reporte Interactivo" : "Interactive Web Report"}:** ${reportUrl}`,
  );
  lines.push(`- **${es ? "Generado" : "Generated"}:** ${report.generatedAt}`);
  lines.push("");

  // Section 1: Executive Verdict
  lines.push(`## 1. ${es ? "Veredicto Ejecutivo" : "Executive Verdict"}`);
  lines.push("");
  lines.push(`> **[${report.verdict.code}]** ${report.verdict.headline}`);
  lines.push("");
  if (report.verdict.winningOptionKey) {
    lines.push(
      `- **${es ? "Opción Ganadora" : "Winning Option"}:** Option ${report.verdict.winningOptionKey} — *"${report.verdict.winningTitle}"*`,
    );
  } else {
    lines.push(
      `- **${es ? "Opción Ganadora" : "Winning Option"}:** ${es ? "Ninguna (mayoría seguiría haciendo scroll)" : "None (majority kept scrolling)"}`,
    );
  }
  lines.push("");
  lines.push(
    `| ${es ? "Opción" : "Option"} | ${es ? "Votos" : "Votes"} | ${es ? "Cuota Simulada" : "Simulated Share"} |`,
  );
  lines.push("| :--- | :---: | :---: |");
  for (const k of ["A", "B", "C"] as const) {
    const opt = report.packagingMatrix.find((o) => o.optionKey === k);
    const s = report.verdict.clickShare[k];
    lines.push(
      `| **Option ${k}**${opt?.isUserDraft ? " *(Draft)*" : ""}: ${opt?.title ?? ""} | ${s.count} | **${s.pct}%** |`,
    );
  }
  const skip = report.verdict.clickShare.none_keep_scrolling;
  lines.push(
    `| **${es ? "Seguiría de largo (Skip)" : "Keep Scrolling (Skip)"}** | ${skip.count} | **${skip.pct}%** |`,
  );
  lines.push("");
  lines.push(
    `### ${es ? "Alerta de Caída de Retención (Primeros 60s)" : "Retention Cliff Warning (Opening 60s)"} — \`${report.verdict.retentionCliff.severity.toUpperCase()}\``,
  );
  lines.push(report.verdict.retentionCliff.summary);
  if (report.verdict.retentionCliff.exact_drop_point_quote) {
    lines.push(
      `> *"${report.verdict.retentionCliff.exact_drop_point_quote}"*`,
    );
  }
  lines.push("");

  // Section 2: Angle & Script Diagnosis
  lines.push(
    `## 2. ${es ? "Diagnóstico de Ángulo y Guion" : "Angle & Script Diagnosis"}`,
  );
  lines.push("");
  lines.push(
    `### ${es ? "Ángulos de Alto Impacto Enterrados en el Guion" : "Buried High-Leverage Angles Found in Full Script"}`,
  );
  for (const angle of report.angleDiagnosis.buriedAngles) {
    lines.push(`- **${angle.angle_name}:** ${angle.why_high_leverage}`);
    lines.push(`  > *"${angle.script_quote}"*`);
  }
  lines.push("");

  if (report.productionMode === "pre_shoot" && report.angleDiagnosis.preShootPlan) {
    const p = report.angleDiagnosis.preShootPlan;
    lines.push(
      `### ${es ? "Pivote de Ángulo y Reescritura de Gancho (Pre-Grabación)" : "Proposed Angle & Opening 60s Hook Rewrite (Pre-Shoot)"}`,
    );
    lines.push(`- **${es ? "Tesis Propuesta" : "Proposed Thesis"}:** ${p.proposed_angle_thesis}`);
    lines.push(`- **${es ? "Título Reescrito" : "Rewritten Title"}:** ${p.rewritten_title}`);
    lines.push("");
    lines.push(`**${es ? "Gancho Reescrito (Primeros 60s):" : "Rewritten Opening 60s Hook:"}**`);
    lines.push("");
    lines.push(p.rewritten_opening_60s_hook);
    lines.push("");
    lines.push(`**${es ? "Cambios Estructurales:" : "Structural Pacing Fixes:"}**`);
    for (const c of p.structural_changes) lines.push(`- ${c}`);
    lines.push("");
  }

  if (
    report.productionMode === "footage_locked" &&
    report.angleDiagnosis.footageLockedPlan
  ) {
    const f = report.angleDiagnosis.footageLockedPlan;
    lines.push(
      `### ${es ? "Corte Cold-Open sin Regrabar (Para Editor)" : "Zero-Reshoot Cold-Open Pull Quote (For Editor)"}`,
    );
    lines.push(`> *"${f.cold_open_pull_quote.verbatim_quote}"*`);
    lines.push("");
    lines.push(
      `- **${es ? "Instrucción de Corte" : "Editor Cut Instruction"}:** ${f.cold_open_pull_quote.editor_cut_instruction}`,
    );
    lines.push(
      `- **${es ? "Por Qué Engancha" : "Why It Hooks"}:** ${f.cold_open_pull_quote.why_it_hooks}`,
    );
    lines.push("");
    lines.push(`**${es ? "Notas de Edición sin Regrabación:" : "Zero-Reshoot Edit Notes:"}**`);
    for (const n of f.editor_cut_notes) lines.push(`- ${n}`);
    lines.push("");
    lines.push(
      `### ${es ? "3 Pivotes de Empaque Sin Regrabar" : "3 Zero-Reshoot Packaging Pivots"}`,
    );
    for (const pivot of f.zero_reshoot_pivots) {
      lines.push(
        `- **${pivot.route_name}** (*${pivot.target_emotion}*): **${pivot.new_title}** — ${pivot.visual_frame_instruction}`,
      );
    }
    lines.push("");
  }

  // Section 3: Side-by-Side Packaging Matrix
  lines.push(
    `## 3. ${es ? "Matriz de Empaque y Notas para Diseñador" : "Side-by-Side Packaging Matrix & Designer Redlines"}`,
  );
  lines.push("");
  for (const opt of report.packagingMatrix) {
    const overall = opt.klickzScore?.overall ?? "N/A";
    lines.push(
      `### Option ${opt.optionKey}${opt.isUserDraft ? ` (${es ? "Tu Borrador" : "Your Draft"})` : ""} — ${opt.angleLabel}`,
    );
    lines.push(`- **${es ? "Título" : "Title"}:** ${opt.title}`);
    lines.push(
      `- **Klickz Score:** ${overall}/100 · **${es ? "Votos Minds" : "Mind Votes"}:** ${opt.voteCount} (${opt.voteSharePct}%)`,
    );
    lines.push(`- **${es ? "Racional Visual" : "Visual Rationale"}:** ${opt.visualRationale}`);
    if (opt.designerRedline) {
      lines.push(
        `- **${es ? "Ajuste Prioritario (Diseñador)" : "Designer Redline (Top Fix)"}:** ${opt.designerRedline.primaryFix}`,
      );
      if (opt.designerRedline.keep.length) {
        lines.push(
          `- **${es ? "Mantener Intacto" : "Keep Untouched"}:** ${opt.designerRedline.keep.join("; ")}`,
        );
      }
      if (opt.designerRedline.flags.length) {
        lines.push(
          `- **Flags:** ${opt.designerRedline.flags.map((fl) => `\`${fl.flag}\``).join(", ")}`,
        );
      }
    }
    lines.push("");
  }

  // Section 4: Voice of the Minds
  lines.push(`## 4. ${es ? "Voz de las Mentes" : "Voice of the Minds"}`);
  lines.push("");
  if (report.verdict.topHesitationKillers.length) {
    lines.push(`### ${es ? "Principales Frenos de Clic" : "Top Hesitation Killers"}`);
    for (const hk of report.verdict.topHesitationKillers) {
      lines.push(`- ${hk.killer}`);
    }
    lines.push("");
  }

  for (const m of report.voiceOfMinds) {
    const voteLabel =
      m.chosenOption === "none_keep_scrolling"
        ? es
          ? "SEGUIR DE LARGO"
          : "KEEP SCROLLING"
        : `Option ${m.chosenOption}`;
    lines.push(
      `#### ${m.name} — *${m.role}* (\`${m.archetype}\`, ${es ? "Voto" : "Vote"}: **${voteLabel}**, ${m.clickConfidence}/10)`,
    );
    lines.push(`- **${es ? "Reacción" : "Click Reason"}:** ${m.verbatimClickReason}`);
    lines.push(`- **${es ? "Freno Principal" : "Hesitation Killer"}:** ${m.topHesitationKiller}`);
    if (m.commentSkepticismQuote) {
      lines.push(
        `- **${es ? "Comentario Escéptico (Pass 2)" : "Simulated Comment (Pass 2)"}:** > *"${m.commentSkepticismQuote}"*`,
      );
    }
    lines.push("");
  }

  if (report.warnings.length) {
    lines.push("---");
    lines.push(`*Notes: ${report.warnings.join(" · ")}*`);
  }

  return lines.join("\n");
}
