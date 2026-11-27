import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { AppError } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const { db, user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write")) {
      throw new AppError(
        403,
        "Allow write access to change report visibility.",
      );
    }
    const { isPublic } = z
      .object({ isPublic: z.boolean() })
      .parse(await request.json());

    const up = await db
      .from("study_reports")
      .update({ is_public: isPublic })
      .eq("slug", slug)
      .eq("user_id", user.id)
      .select("slug,is_public")
      .single();
    if (up.error || !up.data) {
      throw new AppError(404, "Report not found.");
    }
    return NextResponse.json({ report: up.data });
  } catch (e) {
    return failure(e);
  }
}
