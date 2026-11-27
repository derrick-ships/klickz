import "server-only";
import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportPayload } from "../schemas/study";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#18181b",
    lineHeight: 1.45,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 10,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: "#09090b",
    marginBottom: 4,
  },
  metaRow: {
    fontSize: 8.5,
    color: "#52525b",
  },
  verdictBox: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 14,
    borderWidth: 1,
  },
  verdictShip: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  verdictIterate: {
    backgroundColor: "#fffbeb",
    borderColor: "#f59e0b",
  },
  verdictRethink: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },
  verdictTag: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#09090b",
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 3,
  },
  subTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#27272a",
    marginTop: 6,
    marginBottom: 3,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 5,
    padding: 9,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: "#a1a1aa",
    paddingLeft: 8,
    marginVertical: 4,
    fontFamily: "Helvetica-Oblique",
    color: "#3f3f46",
  },
  matrixRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  matrixCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 5,
    padding: 7,
    backgroundColor: "#ffffff",
  },
  thumbImg: {
    width: "100%",
    height: 86,
    objectFit: "cover",
    borderRadius: 3,
    marginBottom: 5,
  },
  pill: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    marginBottom: 2,
  },
  bullet: {
    marginLeft: 8,
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    fontSize: 7.5,
    color: "#a1a1aa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function ReportPdfDocument({
  report,
  thumbDataUrls,
  reportUrl,
}: {
  report: ReportPayload;
  thumbDataUrls: Partial<Record<"A" | "B" | "C", string>>;
  reportUrl: string;
}) {
  const es = report.language.toLowerCase().startsWith("es");
  const verdictStyle =
    report.verdict.code === "SHIP"
      ? styles.verdictShip
      : report.verdict.code === "ITERATE"
        ? styles.verdictIterate
        : styles.verdictRethink;

  return (
    <Document>
      {/* Page 1: Executive Verdict & Side-by-Side Packaging Matrix */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            OpenPikzels · {es ? "Reporte Ejecutivo Pre-Vuelo" : "Executive Pre-Flight Report"}
          </Text>
          <Text style={styles.title}>{report.studyTitleDraft}</Text>
          <Text style={styles.metaRow}>
            {report.channelTitle} · {report.productionMode} · {report.totalMindsResponded} Minds (
            {report.totalSyntheticResponses} {es ? "respuestas" : "responses"}) ·{" "}
            {report.generatedAt.slice(0, 10)}
          </Text>
        </View>

        <View style={[styles.verdictBox, verdictStyle]}>
          <Text style={styles.verdictTag}>
            [{report.verdict.code}] {report.verdict.headline}
          </Text>
          <Text>
            Option A: {report.verdict.clickShare.A.pct}% ({report.verdict.clickShare.A.count}) ·
            Option B: {report.verdict.clickShare.B.pct}% ({report.verdict.clickShare.B.count}) ·
            Option C: {report.verdict.clickShare.C.pct}% ({report.verdict.clickShare.C.count}) ·{" "}
            {es ? "Seguir de largo" : "Keep Scrolling"}:{" "}
            {report.verdict.clickShare.none_keep_scrolling.pct}% (
            {report.verdict.clickShare.none_keep_scrolling.count})
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.subTitle}>
            {es ? "Alerta de Retención (Primeros 60s)" : "Retention Cliff Warning (Opening 60s)"} —{" "}
            {report.verdict.retentionCliff.severity.toUpperCase()}
          </Text>
          <Text>{report.verdict.retentionCliff.summary}</Text>
          {report.verdict.retentionCliff.exact_drop_point_quote ? (
            <Text style={styles.quote}>
              &ldquo;{report.verdict.retentionCliff.exact_drop_point_quote}&rdquo;
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>
          {es ? "Matriz de Empaque (3 Opciones + Notas de Diseño)" : "Side-by-Side Packaging Matrix & Designer Redlines"}
        </Text>
        <View style={styles.matrixRow}>
          {report.packagingMatrix.map((opt) => (
            <View key={opt.optionKey} style={styles.matrixCol}>
              <Text style={styles.pill}>
                OPTION {opt.optionKey}
                {opt.isUserDraft ? (es ? " · TU BORRADOR" : " · YOUR DRAFT") : ""} ·{" "}
                {opt.voteSharePct}% {es ? "VOTOS" : "VOTES"}
              </Text>
              {thumbDataUrls[opt.optionKey] ? (
                <Image src={thumbDataUrls[opt.optionKey]!} style={styles.thumbImg} />
              ) : null}
              <Text style={styles.subTitle}>{opt.title}</Text>
              <Text style={{ fontSize: 8, color: "#52525b", marginBottom: 4 }}>
                Klickz Score: {opt.klickzScore?.overall ?? "–"}/100 · {opt.angleLabel}
              </Text>
              <Text style={{ fontSize: 8, marginBottom: 3 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {es ? "Redline: " : "Redline: "}
                </Text>
                {opt.designerRedline?.primaryFix || "—"}
              </Text>
              {opt.designerRedline?.keep.length ? (
                <Text style={{ fontSize: 7.5, color: "#52525b" }}>
                  {es ? "Mantener: " : "Keep: "}
                  {opt.designerRedline.keep.slice(0, 3).join("; ")}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>{reportUrl}</Text>
          <Text>OpenPikzels Pre-Flight Intelligence</Text>
        </View>
      </Page>

      {/* Page 2: Editorial Angle & Script Diagnosis */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          {es ? "Diagnóstico Editorial y Ángulos Enterrados" : "Editorial Angle & Full-Script Diagnosis"}
        </Text>
        {report.angleDiagnosis.buriedAngles.map((angle, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.subTitle}>{angle.angle_name}</Text>
            <Text>{angle.why_high_leverage}</Text>
            <Text style={styles.quote}>&ldquo;{angle.script_quote}&rdquo;</Text>
          </View>
        ))}

        {report.productionMode === "pre_shoot" &&
        report.angleDiagnosis.preShootPlan ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {es
                ? "Plan Pre-Grabación: Ángulo y Gancho Reescrito"
                : "Pre-Shoot Plan: Proposed Angle & Hook Rewrite"}
            </Text>
            <Text style={styles.subTitle}>
              {es ? "Título Sugerido:" : "Rewritten Title:"}{" "}
              {report.angleDiagnosis.preShootPlan.rewritten_title}
            </Text>
            <Text style={{ marginBottom: 6 }}>
              {report.angleDiagnosis.preShootPlan.proposed_angle_thesis}
            </Text>
            <Text style={styles.subTitle}>
              {es ? "Gancho 60s Reescrito:" : "Rewritten Opening 60s Hook:"}
            </Text>
            <Text style={styles.quote}>
              {report.angleDiagnosis.preShootPlan.rewritten_opening_60s_hook}
            </Text>
            <Text style={styles.subTitle}>
              {es ? "Ajustes Estructurales:" : "Structural Changes:"}
            </Text>
            {report.angleDiagnosis.preShootPlan.structural_changes.map((c, i) => (
              <Text key={i} style={styles.bullet}>
                • {c}
              </Text>
            ))}
          </View>
        ) : null}

        {report.productionMode === "footage_locked" &&
        report.angleDiagnosis.footageLockedPlan ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {es
                ? "Material Cerrado: Corte Cold-Open y 3 Pivotes Sin Regrabar"
                : "Footage Locked: Cold-Open Pull Quote & 3 Zero-Reshoot Pivots"}
            </Text>
            <Text style={styles.subTitle}>
              {es ? "Cita Exacta para Abrir en 0:00:" : "Cold-Open Pull Quote (Move to 0:00):"}
            </Text>
            <Text style={styles.quote}>
              &ldquo;{report.angleDiagnosis.footageLockedPlan.cold_open_pull_quote.verbatim_quote}&rdquo;
            </Text>
            <Text>
              {report.angleDiagnosis.footageLockedPlan.cold_open_pull_quote.editor_cut_instruction}
            </Text>
            <Text style={styles.subTitle}>
              {es ? "3 Pivotes de Empaque Sin Regrabar:" : "3 Zero-Reshoot Packaging Pivots:"}
            </Text>
            {report.angleDiagnosis.footageLockedPlan.zero_reshoot_pivots.map((p, i) => (
              <Text key={i} style={styles.bullet}>
                • {p.route_name}: &ldquo;{p.new_title}&rdquo; — {p.visual_frame_instruction}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{reportUrl}</Text>
          <Text>OpenPikzels Pre-Flight Intelligence</Text>
        </View>
      </Page>

      {/* Page 3+: Voice of the Minds */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          {es ? "Voz de las 16 Mentes (Votos, Objeciones y Comentarios)" : "Voice of the Minds (Votes, Hesitations & Comments)"}
        </Text>
        {report.voiceOfMinds.map((m) => {
          const voteLabel =
            m.chosenOption === "none_keep_scrolling"
              ? es
                ? "SEGUIR DE LARGO"
                : "KEEP SCROLLING"
              : `Option ${m.chosenOption}`;
          return (
            <View key={m.mindId} style={styles.card} wrap={false}>
              <Text style={styles.subTitle}>
                {m.name} ({m.archetype}) · {voteLabel} · {m.clickConfidence}/10
              </Text>
              <Text style={{ fontSize: 8, color: "#52525b", marginBottom: 3 }}>
                {m.role}
              </Text>
              <Text>{m.verbatimClickReason}</Text>
              <Text style={{ fontSize: 8.5, marginTop: 2 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {es ? "Freno: " : "Hesitation: "}
                </Text>
                {m.topHesitationKiller}
              </Text>
              {m.commentSkepticismQuote ? (
                <Text style={styles.quote}>
                  {es ? "Comentario: " : "Comment: "} &ldquo;{m.commentSkepticismQuote}&rdquo;
                </Text>
              ) : null}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text>{reportUrl}</Text>
          <Text>OpenPikzels Pre-Flight Intelligence</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Generates an executive multi-page PDF buffer purely in Node/React (zero Chromium dependency).
 */
export async function renderReportPdfBuffer(
  report: ReportPayload,
  thumbDataUrls: Partial<Record<"A" | "B" | "C", string>>,
  reportUrl: string,
): Promise<Buffer> {
  const doc = React.createElement(ReportPdfDocument, {
    report,
    thumbDataUrls,
    reportUrl,
  });
  const buf = await renderToBuffer(
    doc as unknown as Parameters<typeof renderToBuffer>[0],
  );
  return Buffer.from(buf);
}
