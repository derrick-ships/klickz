import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/admin-db";
import { ExecutiveReportView } from "@/components/reports/report-view";
import type { ReportPayload } from "@/lib/schemas/study";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Executive Pre-Flight Report · OpenPikzels",
  robots: { index: false, follow: false },
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = adminDb();

  const repRes = await db
    .from("study_reports")
    .select("slug,is_public,user_id,payload")
    .eq("slug", slug)
    .maybeSingle();

  if (repRes.error || !repRes.data || !repRes.data.is_public) {
    notFound();
  }

  const report = repRes.data.payload as ReportPayload;
  const signedImageUrls: Partial<Record<"A" | "B" | "C", string>> = {};

  const imagePaths = report.packagingMatrix
    .map((opt) => ({ key: opt.optionKey, path: opt.jpgPath || opt.imagePath }))
    .filter((x): x is { key: "A" | "B" | "C"; path: string } => !!x.path);

  if (imagePaths.length) {
    const signed = await db.storage
      .from("studio-assets")
      .createSignedUrls(
        imagePaths.map((x) => x.path),
        3600,
      );
    if (!signed.error && signed.data) {
      const urlByPath = new Map(
        signed.data
          .filter((s) => s.path && s.signedUrl)
          .map((s) => [s.path!, s.signedUrl!]),
      );
      for (const item of imagePaths) {
        const url = urlByPath.get(item.path);
        if (url) signedImageUrls[item.key] = url;
      }
    }
  }

  return (
    <ExecutiveReportView
      slug={slug}
      report={report}
      initialIsPublic={Boolean(repRes.data.is_public)}
      ownerUserId={repRes.data.user_id as string}
      signedImageUrls={signedImageUrls}
    />
  );
}
