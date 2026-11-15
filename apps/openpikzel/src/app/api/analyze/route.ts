import type { Evaluation } from "@/lib/types";
import { currentModelPreferences } from "@/lib/model-preferences";
import {
  authenticated,
  failure,
  requireAI,
  withUserProviders,
} from "@/lib/server";
import { reviewSchema, AppError } from "@/lib/validation";
import { readVideoEvidence, youtubeVideoId } from "@/lib/video-context";
import { hasProvider, providerKey } from "@/lib/provider-context";
import { evaluateThumbnail } from "@/lib/providers";
import { ownedAsset } from "@/lib/assets";
import { digest } from "@/lib/diagnostics";
import { seal } from "@/lib/crypto";
import { signDiagnostic } from "@/lib/diagnostic-proof";
import { reserveJob, updateJob, ambiguousProviderError } from "@/lib/jobs";
export const maxDuration = 180;
async function handle(request: Request) {
  let context: Awaited<ReturnType<typeof authenticated>> | undefined;
  let jobId: string | undefined;
  let dispatched = false;
  try {
    context = await authenticated(request);
    const { db, user } = context;
    seal({ check: true }, "diagnostic-proof"); // Verify signing configuration before any paid dispatch.
    const input = reviewSchema.parse(await request.json());
    // Jev scores unless the user chose the reviewer model as scorer in Settings → Models.
    const modelScorer = currentModelPreferences().scorer === "model";
    if (modelScorer) requireAI(input.critiqueProvider);
    else requireAI("jev");
    if (input.includeVision) requireAI(input.critiqueProvider);
    if (input.videoUrl) youtubeVideoId(input.videoUrl);
    let path = input.imagePath,
      id = input.creationId;
    if (id) {
      const r = await db
        .from("studio_creations")
        .select("image_path,score")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (r.error || !r.data?.image_path)
        throw new AppError(404, "Choose an uploaded or generated thumbnail.");
      path = r.data.image_path;
      // Same image, same title, same video and a full review already on file: return it. A score
      // shouldn't wander between identical runs, and an unchanged thumbnail shouldn't cost again.
      const saved = r.data.score as Evaluation | null;
      const sameRun = saved && !input.rescore && saved.title === (input.title || saved.title) && (saved.videoEvidence?.url || "") === (input.videoUrl || "") && (!input.includeVision || saved.vision) && saved.overall !== null;
      if (sameRun) return Response.json({ score: saved, creationId: id, jobId: input.requestId, reused: true });
    }
    if (!path) throw new AppError(400, "Choose a thumbnail.");
    const image = await ownedAsset(db, user.id, path),
      reserved = await reserveJob(
        db,
        user.id,
        input.requestId,
        "analyze",
        { ...input, sourceDigest: digest(image) },
        input.includeVision ? 2 : 1,
      );
    if (reserved.replay) return Response.json(reserved.replay);
    jobId = input.requestId;
    await updateJob(db, user.id, jobId, "running");
    const videoEvidence = input.videoUrl ? await readVideoEvidence(input.videoUrl, hasProvider("youtube") ? providerKey("youtube") : undefined) : undefined;
    const assessedTitle = input.title || videoEvidence?.title || "";
    dispatched = true;
    const score = signDiagnostic(
      await evaluateThumbnail(image, assessedTitle, input.requestId, {
        videoBrief: videoEvidence?.description || input.videoBrief,
        videoEvidence,
        audience: input.audience,
        includeVision: input.includeVision,
        critiqueProvider: input.critiqueProvider,
      }),
    );
    if (id) {
      const saved = await db
        .from("studio_creations")
        .update({ score })
        .eq("id", id)
        .eq("user_id", user.id);
      if (saved.error) throw saved.error;
    } else {
      const saved = await db
        .from("studio_creations")
        .insert({
          user_id: user.id,
          title: assessedTitle || "Untitled thumbnail",
          prompt: (assessedTitle || "Uploaded thumbnail").padEnd(8, "."),
          mode: "generate",
          style: "Uploaded",
          lineage:{origin:"uploaded"},
          image_path: path,
          status: "ready",
          score,
        })
        .select("id")
        .single();
      if (saved.error) throw saved.error;
      id = saved.data.id;
    }
    const result = { score, creationId: id, jobId };
    await updateJob(db, user.id, jobId, "succeeded", result);
    return Response.json(result);
  } catch (e) {
    if (context && jobId)
      await updateJob(
        context.db,
        context.user.id,
        jobId,
        dispatched && ambiguousProviderError(e) ? "reconciling" : "failed",
      ).catch(() => {});
    return failure(e);
  }
}
export const POST = (request: Request) =>
  withUserProviders(request, () => handle(request), [
    "studio:ai",
    "studio:write",
  ]);
