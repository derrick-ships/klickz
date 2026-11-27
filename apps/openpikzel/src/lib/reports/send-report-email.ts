import "server-only";
import { Resend } from "resend";
import type { ReportPayload } from "../schemas/study";

export async function sendPreFlightReportEmail(params: {
  to: string[];
  slug: string;
  reportUrl: string;
  report: ReportPayload;
  pdfBuffer: Buffer;
  markdownContent: string;
}): Promise<{ id: string | null; skipped?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { id: null, skipped: "RESEND_API_KEY not configured" };
  }
  const recipients = [
    ...new Set(params.to.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
  if (!recipients.length) {
    return { id: null, skipped: "No email recipient available" };
  }

  const from =
    process.env.RESEND_FROM_EMAIL ||
    "OpenPikzels Reports <reports@openpikzels.com>";
  const es = params.report.language.toLowerCase().startsWith("es");
  const { verdict } = params.report;

  const subject = `[${verdict.code}] ${es ? "Reporte Pre-Vuelo" : "Pre-Flight Report"}: ${params.report.studyTitleDraft.slice(0, 72)}`;

  const badgeColor =
    verdict.code === "SHIP"
      ? "#10b981"
      : verdict.code === "ITERATE"
        ? "#f59e0b"
        : "#ef4444";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#111827;line-height:1.5;">
    <p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin:0 0 8px;">OpenPikzels Pre-Flight Intelligence</p>
    <h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(params.report.studyTitleDraft)}</h1>
    <div style="border-left:4px solid ${badgeColor};background:#f9fafb;padding:14px 16px;border-radius:6px;margin:16px 0;">
      <strong style="color:${badgeColor};font-size:13px;">${verdict.code}</strong>
      <p style="margin:6px 0 0;font-size:15px;font-weight:600;">${escapeHtml(verdict.headline)}</p>
    </div>
    <p style="font-size:14px;color:#374151;">
      <strong>Option A:</strong> ${verdict.clickShare.A.pct}% ·
      <strong>Option B:</strong> ${verdict.clickShare.B.pct}% ·
      <strong>Option C:</strong> ${verdict.clickShare.C.pct}% ·
      <strong>${es ? "Seguir de largo" : "Keep Scrolling"}:</strong> ${verdict.clickShare.none_keep_scrolling.pct}%
    </p>
    <p style="font-size:14px;color:#374151;">
      <strong>${es ? "Alerta de Retención" : "Retention Cliff"} (${verdict.retentionCliff.severity.toUpperCase()}):</strong>
      ${escapeHtml(verdict.retentionCliff.summary)}
    </p>
    <p style="margin:24px 0;">
      <a href="${params.reportUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">
        ${es ? "Abrir Reporte Interactivo" : "Open Interactive Executive Report"}
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280;">
      ${
        es
          ? "Adjunto encontrarás el reporte completo en PDF (listo para tu editor y diseñador) y en Markdown (.md)."
          : "Attached: the full Executive PDF brief (ready for your editor & designer) and the clean Markdown (.md) copy."
      }
    </p>
  </div>`;

  const resend = new Resend(apiKey);
  const res = await resend.emails.send({
    from,
    to: recipients,
    subject,
    html,
    attachments: [
      {
        filename: `preflight-report-${params.slug}.pdf`,
        content: params.pdfBuffer,
      },
      {
        filename: `preflight-report-${params.slug}.md`,
        content: Buffer.from(params.markdownContent, "utf-8"),
      },
    ],
  });

  if (res.error) {
    throw new Error(`Resend error: ${res.error.message}`);
  }
  return { id: res.data?.id ?? null };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
