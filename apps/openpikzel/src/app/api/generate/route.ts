import {
  authenticated,
  failure,
  requireAI,
  withUserProviders,
} from "@/lib/server";
import { generationSchema, AppError } from "@/lib/validation";
import { renderThumbnail } from "@/lib/providers";
import {
  digest,
  editorInstructions,
  validateFixPlan,
  type FixPlan,
} from "@/lib/diagnostics";
import { verifyDiagnostic } from "@/lib/diagnostic-proof";
import { unseal } from "@/lib/crypto";
import { reserveJob, updateJob, ambiguousProviderError } from "@/lib/jobs";
import { providerContext } from "@/lib/provider-context";
import { ownedAsset } from "@/lib/assets";
import { NextResponse } from "next/server";
export const maxDuration = 300;
async function handle(request: Request) {
  let context: Awaited<ReturnType<typeof authenticated>> | undefined;
  let jobId: string | undefined;
  let dispatched = false;
  let fixPlan: FixPlan | undefined;
  try {
    context = await authenticated(request);
    const { db, user } = context;
    const input = generationSchema.parse(await request.json());
    requireAI(input.settings.model.startsWith("gemini-") ? "google" : "openai");
    if (
      !input.settings.model.startsWith("gemini-") &&
      !providerContext.getStore()?.openai
    )
      throw new AppError(
        403,
        "Connect your own OpenAI key for Sunburst/Flare, or choose a Google model.",
      );
    const refs: Buffer[] = [];
    const notes: string[] = [];
    if (input.parentId) {
      const { data, error } = await db
        .from("studio_creations")
        .select("*")
        .eq("id", input.parentId)
        .eq("user_id", user.id)
        .single();
      if (error || !data?.image_path)
        throw new AppError(404, "Choose a rendered thumbnail to edit.");
      const image = await ownedAsset(db, user.id, data.image_path);
      refs.push(image);
      notes.push(
        "The first reference is the original. Preserve the main subject and identity. Apply only the requested edits.",
      );
      if (input.mode === "fix") {
        if (!input.fixPlanToken)
          throw new AppError(
            409,
            "Review a fix plan before generating an API variant.",
          );
        verifyDiagnostic(data.score);
        fixPlan = unseal<FixPlan>(input.fixPlanToken, "fix-plan");
        validateFixPlan(fixPlan, data.id, image, data.score, input.settings);
        if (data.title !== fixPlan.title)
          throw new AppError(
            409,
            "The title changed after review. Prepare a new fix plan.",
          );
        if (
          input.personaId ||
          input.styleId ||
          input.referencePath ||
          input.referencePaths.length ||
          input.title !== fixPlan.title
        )
          throw new AppError(
            409,
            "A reviewed fix uses only its approved source and context.",
          );
        notes.push(editorInstructions(fixPlan));
      }
    }
    const paths = [
      ...new Set(
        [input.referencePath, ...input.referencePaths].filter(
          (p): p is string => !!p,
        ),
      ),
    ];
    for (const path of paths) refs.push(await ownedAsset(db, user.id, path));
    if (paths.length)
      notes.push(
        "Additional image references guide composition and subject details. Create an original result.",
      );
    for (const [table, id, label] of [
      ["studio_personas", input.personaId, "Persona"],
      ["studio_styles", input.styleId, "Style"],
    ] as const) {
      if (!id) continue;
      const { data, error } = await db
        .from(table)
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (error || !data) throw new AppError(404, `${label} not found.`);
      for (const path of data.refs.slice(0, 3))
        refs.push(await ownedAsset(db, user.id, path));
      notes.push(
        `${label} guidance: ${data.identity_brief || ""} ${data.notes}. Preserve identity when using persona photos; use style references for treatment and palette.`,
      );
    }
    if (input.mode === "fix" && !fixPlan)
      throw new AppError(400, "Choose the reviewed source variant.");
    const reserved = await reserveJob(
      db,
      user.id,
      input.requestId,
      "generate",
      { ...input, referenceDigests: refs.map(digest), notes },
      input.settings.batch,
    );
    if (reserved.replay) return NextResponse.json(reserved.replay);
    jobId = input.requestId;
    const previous = await db
      .from("studio_creations")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data)
      throw new AppError(409, "This batch already exists. Check history.");
    const batchRows = Array.from({ length: input.settings.batch }, (_, i) => ({
      user_id: user.id,
      title: input.title || input.prompt.slice(0, 80),
      prompt: input.prompt,
      mode: input.mode,
      style: input.style,
      persona_id: input.personaId || null,
      style_id: input.styleId || null,
      parent_id: input.parentId || null,
      reference_path: paths[0] || null,
      reference_paths: paths,
      settings: input.settings,
      batch_id: input.requestId,
      batch_index: i,
      request_id: i === 0 ? input.requestId : crypto.randomUUID(),
      status: "generating",
      ...(input.parentId
        ? {
            lineage: {
              sourceId: input.parentId,
              sourceDigest: digest(refs[0]),
              ...(fixPlan ? { fixPlanHash: fixPlan.hash, plan: fixPlan } : {}),
            },
          }
        : {}),
    }));
    const reservation = await db
      .from("studio_creations")
      .insert(batchRows)
      .select("id,batch_index");
    if (reservation.error) {
      if (reservation.error.code === "23505")
        throw new AppError(409, "Batch already submitted. Check history.");
      throw reservation.error;
    }
    await updateJob(db, user.id, jobId, "running");
    dispatched = true;
    // Reserve the entire batch atomically, then render concurrently within the function timeout.
    const outcomes = await Promise.allSettled(
      reservation.data
        .sort((a, b) => a.batch_index - b.batch_index)
        .map(async (row) => {
          let renderReturned = false;
          try {
            const prompt = fixPlan
              ? editorInstructions(fixPlan)
              : `Create a professional original YouTube ${input.settings.format === "short" ? "vertical 9:16 cover" : "horizontal 16:9 thumbnail"}. Strong visual hierarchy, clear at 200 px wide, concise readable text if needed. Title context: ${input.title || input.prompt}. Visual direction: ${input.style}. User request: ${input.prompt}. ${notes.join(" ")}. Variation ${row.batch_index + 1}: explore a distinct framing while preserving the promise.`;
            const image = await renderThumbnail(prompt, refs, input.settings);
            renderReturned = true;
            const path = `${user.id}/creations/${row.id}.png`;
            const upload = await db.storage
              .from("studio-assets")
              .upload(path, image, { contentType: "image/png", upsert: false });
            if (upload.error) throw upload.error;
            const saved = await db
              .from("studio_creations")
              .update({ image_path: path, status: "ready" })
              .eq("id", row.id)
              .eq("user_id", user.id)
              .select("*")
              .single();
            if (saved.error) throw saved.error;
            return saved.data;
          } catch (error) {
            await db
              .from("studio_creations")
              .update({
                status: renderReturned || ambiguousProviderError(error)
                  ? "reconciling"
                  : "failed",
              })
              .eq("id", row.id)
              .eq("user_id", user.id);
            throw error;
          }
        }),
    );
    const creations = outcomes
      .filter((o) => o.status === "fulfilled")
      .map((o) => o.value);
    const partial = creations.length < input.settings.batch;
    if (!creations.length)
      throw new AppError(
        502,
        "The render did not finish. Check history before submitting a new batch.",
      );
    const result = { creation: creations[0], creations, partial, jobId };
    await updateJob(
      db,
      user.id,
      jobId,
      partial ? "reconciling" : "succeeded",
      result,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (context && jobId)
      await updateJob(
        context.db,
        context.user.id,
        jobId,
        dispatched ? "reconciling" : "failed",
      ).catch(() => {});
    return failure(error);
  }
}

export const POST = (request: Request) =>
  withUserProviders(request, () => handle(request), [
    "studio:ai",
    "studio:write",
  ]);
