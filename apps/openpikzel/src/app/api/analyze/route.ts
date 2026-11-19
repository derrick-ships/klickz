import type { Evaluation, FixHistoryEntry, ScoreComparison } from "@/lib/types";
import { instructionVersion } from "@/lib/instructions";
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
import sharp from "sharp";
import { actualPreview, analysisInputDigest, compareFix, digest, lineageFixHistory } from "@/lib/diagnostics";
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
    // Any connected scorer can give the numbers (Jev, OpenAI Decisions, Claude, Google), tried in order.
    const modelScorer = currentModelPreferences().scorer === "model";
    if (!(["jev", "openai", "anthropic", "google"] as const).some((p) => hasProvider(p)))
      throw new AppError(403, "Connect Jev, OpenAI, Claude or Google in Connections to score thumbnails.");
    if (input.scorer === "jev" && !hasProvider("jev")) throw new AppError(403, "Connect Jev to retry with Jev.");
    requireAI(input.scorer === "jev" || hasProvider("jev") ? "jev" : (["openai", "anthropic", "google"] as const).find((p) => hasProvider(p))!);
    if (input.includeVision) requireAI(input.critiqueProvider);
    if (input.videoUrl) youtubeVideoId(input.videoUrl);
    let path = input.imagePath,
      id = input.creationId;
    type Row = { style?: string | null; persona_id?: string | null; reference_paths?: string[] | null; id: string; image_path: string | null; score: Evaluation | null; parent_id?: string | null; mode?: string; lineage?: { fix?: { suggestion?: string; parentScore?: number | null }; mediator?: { rawPrompt?: string; enriched?: { concept?: string; imageText?: string[] } } } | null };
    let row: Row | undefined;
    if (id) {
      const r = await db
        .from("studio_creations")
        .select("id,image_path,score,parent_id,mode,lineage,style,persona_id,reference_paths")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (r.error || !r.data?.image_path)
        throw new AppError(404, "Choose an uploaded or generated thumbnail.");
      row = { ...(r.data as Row), id };
      path = r.data.image_path;
    }
    if (!path) throw new AppError(400, "Choose a thumbnail.");
    const image = await ownedAsset(db, user.id, path);
    // Previous fixes on this lineage (walks parent_id, no provider call). They go to the reviewer
    // so the next advice never undoes a fix that worked, and they are part of the cache identity.
    const fixHistory: FixHistoryEntry[] = row ? await lineageFixHistory(db as never, user.id, row, { selfScored: false }) : [];
    // The parent's score when this creation is the result of a fix, to report whether it improved.
    const comparisonFor = async (score: Evaluation): Promise<ScoreComparison | undefined> => {
      if (!row?.parent_id || !(row.lineage?.fix || row.mode === "fix")) return undefined;
      const parent = await db.from("studio_creations").select("id,score").eq("id", row.parent_id).eq("user_id", user.id).maybeSingle();
      const before = (parent.data?.score as Evaluation | null)?.overall ?? row.lineage?.fix?.parentScore;
      return compareFix(row.parent_id, row.id, before, score.overall);
    };
    const scorer = input.scorer === "jev" ? "jev" : modelScorer ? "model" : "jev";
    // Same image, same request, same rubric and instructions, and a complete review already on file:
    // return it without any provider call. A score must not wander between identical runs.
    const saved = row?.score;
    if (saved && !input.rescore && (!input.scorer || saved.scoring?.route.some(r => r.scorer === "jev" && r.outcome === "scored")) && saved.overall !== null && saved.inputDigest && saved.instructionVersion === instructionVersion && (!input.includeVision || saved.vision)) {
      const small = await actualPreview(image), meta = await sharp(small).metadata();
      const base = {
        sourceDigest: digest(image),
        preview: { width: meta.width!, height: meta.height!, digest: digest(small) },
        title: input.title,
        videoBrief: input.videoBrief,
        videoUrl: input.videoUrl,
        audience: input.audience,
        scorer,
        fixHistory,
      };
      // A saved review that also looked at the image satisfies a numbers-only request.
      const candidates = [
        analysisInputDigest({ ...base, includeVision: input.includeVision, critiqueProvider: input.critiqueProvider }),
        ...(!input.includeVision && saved.vision ? (["openai", "anthropic", "google"] as const).map((critiqueProvider) => analysisInputDigest({ ...base, includeVision: true, critiqueProvider })) : []),
      ];
      if (candidates.includes(saved.inputDigest)) {
        const comparison = await comparisonFor(saved);
        return Response.json({ score: saved, creationId: id, jobId: input.requestId, reused: true, ...(comparison ? { comparison } : {}) });
      }
    }
    // Budget: one image review plus up to three scorers (each fallback is one more paid call).
    const reserved = await reserveJob(
        db,
        user.id,
        input.requestId,
        "analyze",
        { ...input, sourceDigest: digest(image) },
        input.scorer === "jev" ? (input.includeVision ? 2 : 1) : input.includeVision ? 4 : 3,
      );
    if (reserved.replay) return Response.json(reserved.replay);
    jobId = input.requestId;
    await updateJob(db, user.id, jobId, "running");
    const videoEvidence = input.videoUrl ? await readVideoEvidence(input.videoUrl, hasProvider("youtube") ? providerKey("youtube") : undefined) : undefined;
    const assessedTitle = input.title || videoEvidence?.title || "";
    // No title? Judge Idea and Curiosity against what the thumbnail was made to promise (like
    // Pikzels): the planned concept and on-image text, or the user's own request.
    const planned = row?.lineage?.mediator;
    const intendedPromise = !assessedTitle && planned ? [planned.enriched?.concept, planned.enriched?.imageText?.length ? `On-image text: ${planned.enriched.imageText.join(" / ")}` : "", planned.rawPrompt ? `Request: ${planned.rawPrompt.slice(0, 400)}` : ""].filter(Boolean).join("\n") : "";
    const uploaded = !row || row.lineage === null || (row.lineage as { origin?: string } | undefined)?.origin === "uploaded";
    dispatched = true;
    let evaluated: Evaluation;
    try {
      evaluated = await evaluateThumbnail(image, assessedTitle, input.requestId, {
        videoBrief: videoEvidence?.description || input.videoBrief,
        intendedPromise,
        style: row?.style && row.style !== "Auto" ? row.style : undefined,
        // A creator's own uploaded thumbnail, a chosen persona or attached references authorize the people
        // and marks in the image; only an unasked-for real face or logo is flagged.
        peopleAuthorized: uploaded || !!row?.persona_id || !!row?.reference_paths?.length,
        marksAuthorized: uploaded || !!row?.reference_paths?.length,
        videoEvidence,
        audience: input.audience,
        includeVision: input.includeVision,
        critiqueProvider: input.critiqueProvider,
        requireScorer: input.scorer,
        fixHistory,
        cacheKey: { title: input.title, videoBrief: input.videoBrief, videoUrl: input.videoUrl },
      });
    } catch (error) {
      // Every scorer answered with an error: nothing was scored, so this request may be tried again.
      if ((error as { scorerAttempts?: unknown }).scorerAttempts) dispatched = false;
      throw error;
    }
    // From here on the providers have answered; a failure below is ours and the request can be retried.
    dispatched = false;
    const score = signDiagnostic(evaluated);
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
    const comparison = await comparisonFor(score);
    const result = { score, creationId: id, jobId, ...(comparison ? { comparison } : {}) };
    await updateJob(db, user.id, jobId, "succeeded", result);
    return Response.json(result);
  } catch (e) {
    const state = dispatched && ambiguousProviderError(e) ? "reconciling" : "failed";
    if (context && jobId)
      await updateJob(context.db, context.user.id, jobId, state).catch(() => {});
    const response = failure(e);
    // "failed" tells the studio nothing uncertain is pending, so its Retry may use a fresh request.
    if (jobId && state === "failed") {
      const body = await response.json();
      return Response.json({ ...body, jobState: "failed" }, { status: response.status });
    }
    return response;
  }
}
export const POST = (request: Request) =>
  withUserProviders(request, () => handle(request), [
    "studio:ai",
    "studio:write",
  ]);
