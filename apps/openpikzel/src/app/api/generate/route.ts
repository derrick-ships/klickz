import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { libraryStyle } from "@/lib/style-library";
import {imageModel} from "@/lib/image-models";
import {instructionVersion, realismContract} from "@/lib/instructions";
import {mediate, imagePromptFrom, MEDIATOR_VERSION, type MediatorRecord} from "@/lib/mediator";
import {principleFiles} from "@/lib/principles.generated";
import {
  authenticated,
  failure,
  requireAI,
  withUserProviders,
} from "@/lib/server";
import { generationSchema, AppError } from "@/lib/validation";
import { renderThumbnail } from "@/lib/providers";
import { personaIdentityContract } from "@/lib/instructions";
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
    requireAI(imageModel(input.settings.model).provider);
    if (
      !input.settings.model.startsWith("gemini-") &&
      !providerContext.getStore()?.openai
    )
      throw new AppError(
        403,
        "Connect your own OpenAI key for Sunburst/Flare, or choose a Google model.",
      );
    if(input.conversationId){const chat=await db.from("studio_conversations").select("id").eq("id",input.conversationId).eq("user_id",user.id).maybeSingle();if(chat.error||!chat.data)throw new AppError(404,"This chat is not available in your account.");}
    let conversationId=input.conversationId||null;
    const refs: Buffer[] = [],seenPaths=new Set<string>();
    async function addReference(path:string){if(seenPaths.has(path))return;seenPaths.add(path);refs.push(await ownedAsset(db,user.id,path));}
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
      if(!conversationId)conversationId=data.conversation_id||null;
      const image = await ownedAsset(db, user.id, data.image_path);
      refs.push(image);seenPaths.add(data.image_path);
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
      // Persona photos go first and as many as the model allows (up to 4): the model weighs early references most.
      const startIndex = refs.length;
      for (const path of data.refs.slice(0, label === "Persona" ? 4 : 3))
        await addReference(path);
      if (label === "Persona" && refs.length > startIndex)
        notes.push(personaIdentityContract(data.name || "the person", startIndex + 1, refs.length));
      const palette = Array.isArray(data.source?.palette) ? data.source.palette.filter((c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) : [];
      notes.push(
        `${label} guidance: ${data.identity_brief || ""} ${data.notes}. Preserve identity when using persona photos; use style references for treatment and palette.${palette.length ? ` Measured style palette, most dominant first: ${palette.join(", ")}.` : ""}`,
      );
    }
    // Library style: its example thumbnails guide treatment and palette; never the people or text in them.
    const library = libraryStyle(input.libraryStyleId);
    if (input.libraryStyleId && !library) throw new AppError(400, "That style isn't in the library.");
    if (library && !input.styleId && !fixPlan) {
      const start = refs.length;
      for (const image of library.images.slice(0, 2)) refs.push(await readFile(join(process.cwd(), "public", image)));
      notes.push(`Style "${library.name}" (${library.category}): reference images ${start + 1}-${refs.length} show the look to follow — lighting, palette, composition, typography treatment. Do not copy their people, logos or words. Look: ${library.description}`);
    }
    const paths = [
      ...new Set(
        [input.referencePath, ...input.referencePaths].filter(
          (p): p is string => !!p,
        ),
      ),
    ];
    for (const path of paths) await addReference(path);
    if (paths.length)
      notes.push(
        "Additional image references guide composition and subject details. Create an original result.",
      );
    if (input.mode === "fix" && !fixPlan)
      throw new AppError(400, "Choose the reviewed source variant.");
    if(refs.length>imageModel(input.settings.model).maxReferences)throw new AppError(400,"Too many references for the selected image model. Remove extra references before running.");
    const reserved = await reserveJob(
      db,
      user.id,
      input.requestId,
      "generate",
      { ...input, referenceDigests: refs.map(digest), notes, instructionVersion },
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
      conversation_id: conversationId,
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
      lineage:{origin:input.intent==="recompose"?"recomposed":input.mode==="edit"||input.mode==="fix"?"edited":"generated",nativeOutput:true,...(input.parentId?{sourceId:input.parentId,sourceDigest:digest(refs[0]),...(fixPlan?{fixPlanHash:fixPlan.hash,plan:fixPlan}:{})}:{})},
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
            // Never send the user's raw prompt to the image model: the mediator turns it (or the
            // reviewed fix plan) into an enriched prompt with explicit playbook do's and don'ts.
            const rawPrompt = fixPlan ? editorInstructions(fixPlan) : input.prompt;
            const mediated = await mediate({
              rawPrompt,
              title: input.title,
              format: input.settings.format,
              style: input.style,
              notes,
              variation: input.variationOffset + row.batch_index + 1,
              variationTotal: Math.max(input.variationTotal, input.settings.batch),
              hasPersona: !!input.personaId,
              isEdit: !!input.parentId,
              // A reviewed fix carries its own wording to keep; its plan JSON is not user text to mine for quotes.
              ...(fixPlan ? { substantial: { exactText: fixPlan.preserve.exactText, numbers: [], panels: null, orientation: input.settings.format === "short" ? "vertical" as const : "horizontal" as const } } : {}),
            });
            const prompt = imagePromptFrom(mediated.enriched, notes, realismContract);
            const mediator: MediatorRecord = { version: MEDIATOR_VERSION, provider: mediated.provider, model: mediated.model, rawPrompt, substantial: mediated.substantial, enriched: mediated.enriched, imagePrompt: prompt, attempts: mediated.attempts, principleFiles };
            const recorded = await db
              .from("studio_creations")
              .update({ lineage: { ...(batchRows[row.batch_index].lineage), mediator } })
              .eq("id", row.id)
              .eq("user_id", user.id);
            if (recorded.error) throw recorded.error;
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
                status: renderReturned || (ambiguousProviderError(error) && !(error as { notRendered?: boolean })?.notRendered)
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
    if (!creations.length) {
      // If nothing reached the image model, say why instead of a generic render failure.
      const first = outcomes.find((o) => o.status === "rejected") as PromiseRejectedResult | undefined;
      if ((first?.reason as { notRendered?: boolean })?.notRendered) { dispatched = false; throw first!.reason; }
      throw new AppError(
        502,
        "The render did not finish. Check history before submitting a new batch.",
      );
    }
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
