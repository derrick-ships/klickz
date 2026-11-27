import "server-only";
import { adminDb } from "../admin-db";
import { ownedAsset } from "../assets";
import {
  generatePackagingAsset,
  scorePackagingAsset,
} from "../engine/packaging-engine";
import { callStructuredJson } from "../llm-router";
import { currentModelPreferences } from "../model-preferences";
import {
  packagingConceptSetSchema,
  type PackagingConcept,
  type ProductionMode,
} from "../schemas/study";
import { defaultSettings } from "../types";
import { youtubeJpeg } from "../youtube-jpeg";

export type LegAInput = {
  userId: string;
  studyRunId: string;
  language: string;
  productionMode: ProductionMode;
  titleDraft: string;
  scriptText: string;
  thumbnailPrompt: string;
  draftThumbnailPath: string | null;
  personaId: string | null;
  personaTone: string;
  personaVisualRules: string;
  styleId: string | null;
  audienceSummary: string;
  outlierPatterns: unknown;
};

/**
 * Generates packaging concept briefs (2 challengers if user uploaded a draft thumbnail
 * as Option A; otherwise 3 distinct routes A/B/C).
 */
export async function conceptPackagingRoutes(
  input: LegAInput,
): Promise<PackagingConcept[]> {
  const hasDraft = !!input.draftThumbnailPath;
  const targetKeys = hasDraft ? ["B", "C"] : ["A", "B", "C"];

  const modeConstraint =
    input.productionMode === "footage_locked"
      ? `PRODUCTION MODE = FOOTAGE_LOCKED (ZERO RESHOOTS): You MUST NOT invent unfilmed scenes, props, outfits, or locations not already grounded in the script or creator persona. Every option must include a concrete "footage_grounding" note explaining what filmed/existing elements it uses.`
      : `PRODUCTION MODE = PRE_SHOOT: Full creative freedom to pitch sharper visual angles and stronger titles before filming.`;

  const { data } = await callStructuredJson({
    role: "strategist",
    schema: packagingConceptSetSchema,
    maxTokens: 3200,
    system: `You are a Principal YouTube Packaging Director. Create ${targetKeys.length} genuinely distinct, high-leverage YouTube Packaging Options (${targetKeys.join(", ")}) that NEVER repeat the title verbatim on the thumbnail image.
LANGUAGE RULE: Write every title, angle_label, visual_rationale, and any quoted on-image text in natural "${input.language}". Write thumbnail_prompt in clear descriptive English (keeping quoted on-image text in "${input.language}").
${modeConstraint}
CREATOR TONE: ${input.personaTone || "Authentic, clear, zero hype."}
CREATOR VISUAL RULES: ${input.personaVisualRules || "High contrast, single focal point, phone-legible."}`,
    userPrompt: JSON.stringify({
      task: hasDraft
        ? "The creator uploaded their own draft thumbnail + title as Option A. Design 2 sharper challenger options (B and C) using completely different visual and psychological angles to try to beat Option A."
        : "Design 3 genuinely distinct packaging options: Option A (sharpest direct evolution of creator's draft), Option B (curiosity/tension contrarian angle), Option C (concrete stakes/outcome proof angle).",
      requiredOptionKeys: targetKeys,
      draftTitle: input.titleDraft,
      creatorThumbnailPrompt: input.thumbnailPrompt,
      scriptExcerpt: input.scriptText.slice(0, 6500),
      audienceSummary: input.audienceSummary,
      channelOutlierPatterns: input.outlierPatterns,
      requiredJsonShape: {
        options: [
          {
            option_key: targetKeys[0],
            angle_label: "Short route name",
            title: "Truthful YouTube title under 90 chars",
            thumbnail_prompt:
              "Concrete visual scene, subject expression, single focal point, max 2-3 words quoted if needed, no generic filler",
            visual_rationale: "Why this packaging stops scroll for this audience",
            emotional_lever: "INTRIGA|MIEDO|DESEO",
            footage_grounding:
              "Required for footage_locked: how this stays 100% zero-reshoot",
          },
        ],
      },
    }),
  });

  // Normalize option_key order cleanly
  return targetKeys.map((key, idx) => {
    const found =
      data.options.find((o) => o.option_key === key) ??
      data.options[idx] ??
      data.options[0];
    return { ...found, option_key: key as "A" | "B" | "C" };
  });
}

/**
 * Evaluates the creator's uploaded draft thumbnail head-to-head as Option A.
 */
export async function processUserDraftOptionA(input: LegAInput) {
  if (!input.draftThumbnailPath) {
    throw new Error("No draft thumbnail path supplied.");
  }
  const db = adminDb();
  const imageBuffer = await ownedAsset(
    db,
    input.userId,
    input.draftThumbnailPath,
  );
  const jpgBuffer = await youtubeJpeg(imageBuffer, false);
  const jpgPath = `${input.userId}/studies/${input.studyRunId}/option-A-draft.jpg`;
  await db.storage
    .from("studio-assets")
    .upload(jpgPath, jpgBuffer, { contentType: "image/jpeg", upsert: true });

  const scorecard = await scorePackagingAsset(imageBuffer, {
    title: input.titleDraft,
    videoBrief: input.scriptText.slice(0, 2200),
    audienceSummary: input.audienceSummary,
    requestId: `${input.studyRunId}-option-A`,
    peopleAuthorized: true,
    marksAuthorized: true,
  });

  const row = {
    study_run_id: input.studyRunId,
    user_id: input.userId,
    option_key: "A" as const,
    is_user_draft: true,
    angle_label:
      input.language.toLowerCase().startsWith("es")
        ? "Tu Borrador Actual"
        : "Your Current Draft",
    title: input.titleDraft,
    visual_rationale:
      input.language.toLowerCase().startsWith("es")
        ? "Miniatura y título originales del creador evaluados cara a cara contra los 2 retadores de IA."
        : "Creator's uploaded draft thumbnail and title tested head-to-head against 2 AI challengers.",
    emotional_lever: "INTRIGA",
    footage_grounding: "Creator's existing draft asset",
    image_path: input.draftThumbnailPath,
    jpg_path: jpgPath,
    mediator_record: null,
    klickz_score: scorecard.evaluation,
    feed_check: scorecard.feedCheck,
    designer_redline: scorecard.designerRedline,
  };

  const up = await db
    .from("packaging_options")
    .upsert(row, { onConflict: "study_run_id,option_key" });
  if (up.error) throw up.error;
  return row;
}

/**
 * Generates and scores one AI Packaging Option (A, B, or C) using the wrapped Klickz PackagingEngine.
 */
export async function renderAndScoreOption(
  input: LegAInput,
  concept: PackagingConcept,
  variationIndex: number,
  variationTotal: number,
) {
  const db = adminDb();
  const prefs = currentModelPreferences();
  const settings = {
    ...defaultSettings,
    model: prefs.image || "flare",
    quality: "medium" as const,
    batch: 1 as const,
  };

  const asset = await generatePackagingAsset(db, {
    userId: input.userId,
    storagePrefix: `studies/${input.studyRunId}/option-${concept.option_key}`,
    rawPrompt: concept.thumbnail_prompt,
    title: concept.title,
    personaId: input.personaId,
    styleId: input.styleId,
    variation: variationIndex,
    variationTotal,
    settings,
  });

  const scorecard = await scorePackagingAsset(asset.imageBuffer, {
    title: concept.title,
    videoBrief: input.scriptText.slice(0, 2200),
    audienceSummary: input.audienceSummary,
    requestId: `${input.studyRunId}-option-${concept.option_key}`,
    peopleAuthorized: asset.peopleAuthorized,
    marksAuthorized: asset.marksAuthorized,
  });

  const row = {
    study_run_id: input.studyRunId,
    user_id: input.userId,
    option_key: concept.option_key,
    is_user_draft: false,
    angle_label: concept.angle_label,
    title: concept.title,
    visual_rationale: concept.visual_rationale,
    emotional_lever: concept.emotional_lever,
    footage_grounding: concept.footage_grounding ?? null,
    image_path: asset.imagePath,
    jpg_path: asset.jpgPath,
    mediator_record: asset.mediatorRecord,
    klickz_score: scorecard.evaluation,
    feed_check: scorecard.feedCheck,
    designer_redline: scorecard.designerRedline,
  };

  const up = await db
    .from("packaging_options")
    .upsert(row, { onConflict: "study_run_id,option_key" });
  if (up.error) throw up.error;
  return row;
}
