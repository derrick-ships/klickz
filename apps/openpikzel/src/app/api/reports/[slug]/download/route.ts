import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin-db";
import { authenticated, failure } from "@/lib/server";
import { AppError } from "@/lib/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const format = new URL(request.url).searchParams.get("format") || "pdf";
    if (format !== "pdf" && format !== "md") {
      throw new AppError(400, "Format must be pdf or md.");
    }

    const db = adminDb();
    const repRes = await db
      .from("study_reports")
      .select("user_id,slug,is_public,pdf_path,markdown_path")
      .eq("slug", slug)
      .maybeSingle();

    if (repRes.error || !repRes.data) {
      throw new AppError(404, "Report not found.");
    }

    if (!repRes.data.is_public) {
      const auth = await authenticated(request).catch(() => null);
      if (!auth || auth.user.id !== repRes.data.user_id) {
        throw new AppError(404, "Report not found.");
      }
    }

    const path =
      format === "pdf" ? repRes.data.pdf_path : repRes.data.markdown_path;
    if (!path) {
      throw new AppError(404, "Deliverable file not available yet.");
    }

    const fileRes = await db.storage.from("studio-assets").download(path);
    if (fileRes.error || !fileRes.data) {
      throw new AppError(404, "Could not download report file.");
    }
    const bytes = Buffer.from(await fileRes.data.arrayBuffer());

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="preflight-report-${slug}.${format}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
