import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { ownedAsset } from "@/lib/assets";
import { settingsSchema, AppError } from "@/lib/validation";
import { compileFixPlan, digest, lineageFixHistory } from "@/lib/diagnostics";
import { verifyDiagnostic } from "@/lib/diagnostic-proof";
import { seal } from "@/lib/crypto";
import { FIX_PLAN_NOTICE } from "@/lib/fix-plan-notice";
export async function POST(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    if (oauth && !oauth.scope.includes("studio:write"))
      throw new AppError(403, "Agent needs write permission.");
    const list = z.array(z.string().trim().min(1).max(160)).max(8);
    const input = z
      .object({
        creationId: z.string().uuid(),
        settings: settingsSchema.default({ batch: 1 }),
        // "suggestion" selects the review's single One-Click Fix; pillar ids select the legacy issues.
        issueIds: z.array(z.string().max(80)).max(3).optional(),
        preserve: z
          .object({
            exactText: list.default([]),
            requiredObjects: list.default([]),
            forbiddenChanges: list.default([]),
          })
          .default({}),
      })
      .strict()
      .parse(await request.json());
    const r = await db
      .from("studio_creations")
      .select("*")
      .eq("id", input.creationId)
      .eq("user_id", user.id)
      .single();
    if (r.error || !r.data?.image_path || !r.data.score)
      throw new AppError(404, "Choose an analyzed thumbnail.");
    if (r.data.score.title !== r.data.title)
      throw new AppError(
        409,
        "The title changed. Re-analyze the current packaging first.",
      );
    verifyDiagnostic(r.data.score);
    const source = await ownedAsset(db, user.id, r.data.image_path);
    // Earlier fixes on this lineage (oldest first, ≤5), including the one that produced this source.
    const history = await lineageFixHistory(db as never, user.id, r.data, { selfScored: true });
    const result = compileFixPlan(
      r.data.score,
      input.creationId,
      digest(source),
      input.settings,
      input.preserve,
      input.issueIds,
      history,
    );
    return Response.json(
      result.kind === "ready"
        ? {
            ...result,
            token: seal(result.plan, "fix-plan"),
            providerCalls: 1,
            notice:
              FIX_PLAN_NOTICE,
          }
        : result,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
