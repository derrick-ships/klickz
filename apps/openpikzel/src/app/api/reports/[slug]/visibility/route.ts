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
    sameOrigin(request);
    const { slug } = await context.params;
    const { db, user } = await authenticated(request);
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
