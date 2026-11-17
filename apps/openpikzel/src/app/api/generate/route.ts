import {elementDefinitions,type Element,type ReferenceAttachment} from "@/lib/elements";
import { youtubeJpeg } from "@/lib/youtube-jpeg";
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
  fixEditPrompt,
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
  let fixParentScore: number | null = null;
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
    const refs: Buffer[] = [],seenPaths=new Set<string>(),referenceNumbers=new Map<string,number>();
    async function addReference(path:string){if(seenPaths.has(path))return;seenPaths.add(path);refs.push(await ownedAsset(db,user.id,path));referenceNumbers.set(path,refs.length);}
    const notes: string[] = [];
    const attachments:ReferenceAttachment[]=[];
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
      refs.push(image);seenPaths.add(data.image_path);referenceNumbers.set(data.image_path,refs.length);attachments.push({role:"reference",images:[refs.length]});
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
          input.personaIds.length ||
          input.elementIds.length ||
          input.styleId ||
          input.referencePath ||
          input.referencePaths.length ||
          input.title !== fixPlan.title
        )
          throw new AppError(
            409,
            "A reviewed fix uses only its approved source and context.",
          );
        // A single-suggestion fix is an EDIT: the change and the keep list travel as the raw prompt,
        // so the notes only carry the original-image role (no second copy of the plan).
        if (!fixPlan.suggestion) notes.push(editorInstructions(fixPlan));
        fixParentScore = typeof data.score?.overall === "number" ? data.score.overall : null;
      }
    }
    // Personas: the single personaId (older clients, MCP) plus the composer's @mentions, deduplicated, at most 3.
    const personaIds = [...new Set([input.personaId, ...input.personaIds].filter((v): v is string => !!v))];
    if (personaIds.length > 3) throw new AppError(400, "Mention at most three personas in one thumbnail.");
    // Persona photos go first: the model weighs early references most. One persona sends up to 4 photos;
    // several share the budget (2 each) so every face is represented and the model's reference cap holds.
    const photosPerPersona = personaIds.length > 1 ? 2 : 4;
    for (const id of personaIds) {
      const { data, error } = await db.from("studio_personas").select("*").eq("id", id).eq("user_id", user.id).single();
      if (error || !data) throw new AppError(404, "Persona not found.");
      const startIndex = refs.length;
      for (const path of data.refs.slice(0, photosPerPersona)) await addReference(path);
      if (refs.length > startIndex)
        notes.push(personaIdentityContract(data.name || "the person", startIndex + 1, refs.length, personaIds.length));
      attachments.push({role:"persona",name:data.name,images:data.refs.slice(0,photosPerPersona).map((p:string)=>referenceNumbers.get(p)!)});
      notes.push(`PERSONA guidance for ${data.name || "this person"}: ${data.identity_brief || ""} ${data.notes}. Preserve identity when using persona photos.`);
    }
    const elementIds=[...new Set(input.elementIds)];
    const elements:Element[]=[];
    for(const id of elementIds){const result=await db.from("studio_elements").select("*").eq("id",id).eq("user_id",user.id).single();if(result.error||!result.data)throw new AppError(404,"Element not found.");elements.push(result.data as Element);}
    let styleData:any=null;
    if(input.styleId){const result=await db.from("studio_styles").select("*").eq("id",input.styleId).eq("user_id",user.id).single();if(result.error||!result.data)throw new AppError(404,"Style not found.");styleData=result.data;}
    const userPaths=[...new Set([input.referencePath,...input.referencePaths].filter((p):p is string=>!!p))];
    let elementPhotos=3;
    const total=(count:number)=>new Set([...seenPaths,...elements.flatMap(e=>e.refs.slice(0,count)),...(styleData?.refs.slice(0,3)||[]),...userPaths]).size+(!input.styleId&&input.libraryStyleId?(libraryStyle(input.libraryStyleId)?.images.slice(0,2).length||0):0);
    if(total(elementPhotos)>imageModel(input.settings.model).maxReferences)elementPhotos=1;
    if(total(elementPhotos)>imageModel(input.settings.model).maxReferences)throw new AppError(400,"Too many images for this model: remove an element or a reference");
    const elementReferencePaths:string[]=[];
    for(const element of elements){const paths=element.refs.slice(0,elementPhotos);for(const path of paths){await addReference(path);elementReferencePaths.push(path);}const images=paths.map(p=>referenceNumbers.get(p)!);attachments.push({role:"element",kind:element.kind,name:element.name,images});notes.push(`ELEMENT (${element.kind}) "${element.name}": reference images ${images.join(', ')}. ${elementDefinitions[element.kind].description} ${element.identity_brief||''} ${element.notes}`);}
    if(styleData){const data=styleData;for(const path of data.refs.slice(0,3))await addReference(path);const images=data.refs.slice(0,3).map((p:string)=>referenceNumbers.get(p)!);attachments.push({role:"style",name:data.name,images});const palette=Array.isArray(data.source?.palette)?data.source.palette.filter((c:unknown)=>typeof c==="string"&&/^#[0-9a-f]{6}$/i.test(c)):[];notes.push(`STYLE "${data.name}": reference images ${images.join(', ')} guide only treatment and palette, not people or objects. ${data.identity_brief||''} ${data.notes}. Measured palette: ${palette.join(', ')}`);}
    // Library style: its example thumbnails guide treatment and palette; never the people or text in them.
    const library = libraryStyle(input.libraryStyleId);
    if (input.libraryStyleId && !library) throw new AppError(400, "That style isn't in the library.");
    if (library && !input.styleId && !fixPlan) {
      const start = refs.length;
      for (const image of library.images.slice(0, 2)) refs.push(await readFile(join(process.cwd(), "public", image)));
      attachments.push({role:"style",name:library.name,images:Array.from({length:refs.length-start},(_,i)=>start+i+1)});
      notes.push(`STYLE "${library.name}" (${library.category}): reference images ${start + 1}-${refs.length} show the look to follow — lighting, palette, composition, typography treatment. Do not copy their people, logos or words. Look: ${library.description}`);
    }
    const paths = [
      ...new Set(
        [input.referencePath, ...input.referencePaths].filter(
          (p): p is string => !!p,
        ),
      ),
    ];
    for (const path of paths){await addReference(path);attachments.push({role:"reference",images:[referenceNumbers.get(path)!]});}
    if (paths.length)
      notes.push(
        `Additional references (images ${paths.map(p=>referenceNumbers.get(p)).join(", ")}) are attached. Copy any face, product or brand mark in them exactly. Do not invent a substitute logo. Create an original composition around those copied marks.`,
      );
    if (input.mode === "fix" && !fixPlan)
      throw new AppError(400, "Choose the reviewed source variant.");
    if(refs.length>imageModel(input.settings.model).maxReferences)throw new AppError(400,"Too many images for this model: remove an element or a reference");
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
      persona_id: personaIds[0] || null,
      style_id: input.styleId || null,
      parent_id: input.parentId || null,
      reference_path: paths[0] || null,
      reference_paths: paths,
      settings: input.settings,
      batch_id: input.requestId,
      batch_index: i,
      request_id: i === 0 ? input.requestId : crypto.randomUUID(),
      status: "generating",
      lineage:{elementIds,elementReferencePaths,...(personaIds.length>1?{personaIds}:{}),origin:input.intent==="recompose"?"recomposed":input.mode==="edit"||input.mode==="fix"?"edited":"generated",nativeOutput:true,...(input.parentId?{sourceId:input.parentId,sourceDigest:digest(refs[0]),...(fixPlan?{fixPlanHash:fixPlan.hash,plan:fixPlan,...(fixPlan.suggestion?{fix:{suggestion:fixPlan.suggestion,keep:fixPlan.keep||[],keepText:fixPlan.preserve.exactText,parentScore:fixParentScore,history:fixPlan.history||[]}}:{})}:{})}:{})},
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
            // A single-suggestion fix makes the mediator an editor of the original, not a new concept.
            const rawPrompt = fixPlan ? (fixPlan.suggestion ? fixEditPrompt(fixPlan) : editorInstructions(fixPlan)) : input.prompt;
            const mediated = await mediate({
              rawPrompt,
              title: input.title,
              format: input.settings.format,
              style: input.style,
              notes,
              attachments,
              variation: input.variationOffset + row.batch_index + 1,
              variationTotal: Math.max(input.variationTotal, input.settings.batch),
              hasPersona: personaIds.length > 0,
              isEdit: !!input.parentId,
              referenceImages: refs,
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
            // A YouTube-ready copy next to the original: 16:9 (or 9:16) JPG under 2 MB.
            // Best effort: the PNG is the saved result; a failed copy never fails the render.
            try {
              const jpg = await youtubeJpeg(image, input.settings.format === "short");
              const jpgUpload = await db.storage.from("studio-assets").upload(`${user.id}/creations/${row.id}.jpg`, jpg, { contentType: "image/jpeg", upsert: false });
              if (jpgUpload.error) console.error("[generate] jpg copy not saved", jpgUpload.error.message);
            } catch (error) {
              console.error("[generate] jpg copy failed", error instanceof Error ? error.message : error);
            }
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
