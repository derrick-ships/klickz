import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownedAsset } from "../assets";
import { signDiagnostic } from "../diagnostic-proof";
import { imageModel } from "../image-models";
import { personaIdentityContract, realismContract } from "../instructions";
import {
  imagePromptFrom,
  mediate,
  MEDIATOR_VERSION,
  type MediatorRecord,
} from "../mediator";
import { principleFiles } from "../principles.generated";
import { hasProvider, providerContext } from "../provider-context";
import { evaluateThumbnail, renderThumbnail } from "../providers";
import {
  defaultSettings,
  pillars,
  type Evaluation,
  type Pillar,
  type Settings,
} from "../types";
import { pickVisionProvider } from "../vision-provider";
import { youtubeJpeg } from "../youtube-jpeg";
import { serverFeedCheck, type ServerFeedCheckResult } from "./server-feed-check";
import type { ReferenceAttachment } from "../elements";

export type DesignerRedline = {
  primaryFix: string;
  keep: string[];
  keepText: string[];
  flags: { pillar: Pillar | "global"; flag: string }[];
  pillarNotes: Record<
    Pillar,
    { score: number | null; strength: string; weakness: string; fix: string }
  >;
};

export type PackagingScorecard = {
  overall: number | null;
  evaluation: Evaluation;
  feedCheck: ServerFeedCheckResult;
  designerRedline: DesignerRedline;
};

export type GeneratePackagingInput = {
  userId: string;
  storagePrefix: string;
  rawPrompt: string;
  title: string;
  styleLabel?: string;
  personaId?: string | null;
  styleId?: string | null;
  referencePaths?: string[];
  variation: number;
  variationTotal: number;
  settings?: Settings;
};

export type GeneratedPackagingAsset = {
  imageBuffer: Buffer;
  jpgBuffer: Buffer;
  imagePath: string;
  jpgPath: string;
  mediatorRecord: MediatorRecord;
  peopleAuthorized: boolean;
  marksAuthorized: boolean;
};

/**
 * Headless Visual Engine wrapper around Klickz's mediator + renderer + storage uploader.
 * Runs inside an active `providerContext` (worker or route) with zero HTTP coupling.
 */
export async function generatePackagingAsset(
  db: SupabaseClient,
  input: GeneratePackagingInput,
): Promise<GeneratedPackagingAsset> {
  const keys = providerContext.getStore() || {};
  const baseSettings: Settings = {
    ...(input.settings ?? defaultSettings),
    batch: 1,
  };
  // Automatically fall back to Google image model if user only connected Google
  const settings: Settings =
    imageModel(baseSettings.model).provider === "openai" &&
    !keys.openai &&
    keys.google
      ? { ...baseSettings, model: "gemini-flash" }
      : imageModel(baseSettings.model).provider === "google" &&
          !keys.google &&
          keys.openai
        ? { ...baseSettings, model: "flare" }
        : baseSettings;

  const refs: Buffer[] = [];
  const seen = new Set<string>();
  const refNums = new Map<string, number>();
  const notes: string[] = [];
  const attachments: ReferenceAttachment[] = [];

  async function addRef(path: string) {
    if (seen.has(path)) return;
    seen.add(path);
    refs.push(await ownedAsset(db, input.userId, path));
    refNums.set(path, refs.length);
  }

  let hasPersona = false;
  if (input.personaId) {
    const pRes = await db
      .from("studio_personas")
      .select("*")
      .eq("id", input.personaId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (pRes.data) {
      hasPersona = true;
      const start = refs.length;
      const personaRefs: string[] = (pRes.data.refs || []).slice(0, 3);
      for (const p of personaRefs) await addRef(p);
      if (refs.length > start) {
        notes.push(
          personaIdentityContract(
            pRes.data.name || "the creator",
            start + 1,
            refs.length,
            1,
          ),
        );
      }
      attachments.push({
        role: "persona",
        name: pRes.data.name,
        images: personaRefs.map((p) => refNums.get(p)!).filter(Boolean),
      });
      const rules = [
        pRes.data.identity_brief,
        pRes.data.visual_style_rules,
        pRes.data.notes,
      ]
        .filter(Boolean)
        .join(" ");
      if (rules) {
        notes.push(`CREATOR PERSONA (${pRes.data.name}): ${rules}`);
      }
    }
  }

  let chosenStyle: Parameters<typeof mediate>[0]["chosenStyle"] = null;
  if (input.styleId) {
    const sRes = await db
      .from("studio_styles")
      .select("*")
      .eq("id", input.styleId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (sRes.data) {
      const styleRefs: string[] = (sRes.data.refs || []).slice(0, 2);
      for (const p of styleRefs) await addRef(p);
      const imgs = styleRefs.map((p) => refNums.get(p)!).filter(Boolean);
      attachments.push({ role: "style", name: sRes.data.name, images: imgs });
      const palette = Array.isArray(sRes.data.source?.palette)
        ? sRes.data.source.palette.filter(
            (c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
          )
        : [];
      notes.push(
        `STYLE "${sRes.data.name}": references ${imgs.join(", ")} guide visual treatment & palette only. ${sRes.data.identity_brief || ""} ${sRes.data.notes || ""} ${palette.length ? "Measured palette: " + palette.join(", ") : ""}`,
      );
      chosenStyle = {
        name: sRes.data.name,
        mode: "look",
        composition:
          sRes.data.identity_brief ||
          sRes.data.notes ||
          "Follow the saved style layout and lighting.",
        description: [sRes.data.identity_brief, sRes.data.notes]
          .filter(Boolean)
          .join(" "),
        text: "none",
        take: [
          "layout",
          "framing",
          "subject arrangement",
          "graphic device",
          "lighting",
          "palette",
          "rendering treatment",
        ],
        avoid: ["words/text in the examples", "people", "logos/brands"],
        exampleImages: [],
      };
    }
  }

  const extraPaths = (input.referencePaths || []).filter(Boolean).slice(0, 2);
  for (const p of extraPaths) {
    await addRef(p);
    const idx = refNums.get(p);
    if (idx) attachments.push({ role: "reference", images: [idx] });
  }

  const mediated = await mediate({
    rawPrompt: input.rawPrompt,
    title: input.title,
    format: settings.format,
    style: input.styleLabel || "Auto",
    chosenStyle,
    notes,
    attachments,
    variation: input.variation,
    variationTotal: input.variationTotal,
    hasPersona,
    isEdit: false,
    referenceImages: refs,
  });

  const finalPrompt = imagePromptFrom(mediated.enriched, notes, realismContract);
  const mediatorRecord: MediatorRecord = {
    version: MEDIATOR_VERSION,
    provider: mediated.provider,
    model: mediated.model,
    rawPrompt: input.rawPrompt,
    substantial: mediated.substantial,
    enriched: mediated.enriched,
    imagePrompt: finalPrompt,
    attempts: mediated.attempts,
    principleFiles,
  };

  const imageBuffer = await renderThumbnail(finalPrompt, refs, settings);
  const jpgBuffer = await youtubeJpeg(imageBuffer, settings.format === "short");

  const imagePath = `${input.userId}/${input.storagePrefix}.png`;
  const jpgPath = `${input.userId}/${input.storagePrefix}.jpg`;

  const [pngUp, jpgUp] = await Promise.all([
    db.storage.from("studio-assets").upload(imagePath, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    }),
    db.storage.from("studio-assets").upload(jpgPath, jpgBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    }),
  ]);
  if (pngUp.error) throw pngUp.error;
  if (jpgUp.error) throw jpgUp.error;

  return {
    imageBuffer,
    jpgBuffer,
    imagePath,
    jpgPath,
    mediatorRecord,
    peopleAuthorized: hasPersona || extraPaths.length > 0,
    marksAuthorized: extraPaths.length > 0,
  };
}

/**
 * Headless Virality & Legibility Scorer wrapping Klickz's 5-pillar evaluator
 * + 200px phone preview + flag penalties + Sharp pixel legibility checks.
 */
export async function scorePackagingAsset(
  imageBuffer: Buffer,
  params: {
    title: string;
    videoBrief: string;
    audienceSummary: string;
    requestId: string;
    style?: string;
    peopleAuthorized?: boolean;
    marksAuthorized?: boolean;
  },
): Promise<PackagingScorecard> {
  const keys = providerContext.getStore() || {};
  const visionProvider = pickVisionProvider(keys);
  const includeVision = !!visionProvider && hasProvider(visionProvider);

  const [evaluated, feedCheck] = await Promise.all([
    evaluateThumbnail(imageBuffer, params.title, params.requestId, {
      videoBrief: params.videoBrief,
      audience: params.audienceSummary,
      includeVision,
      critiqueProvider: visionProvider ?? "openai",
      style: params.style,
      peopleAuthorized: params.peopleAuthorized ?? true,
      marksAuthorized: params.marksAuthorized ?? true,
    }),
    serverFeedCheck(imageBuffer),
  ]);

  let signed = evaluated;
  try {
    signed = signDiagnostic(evaluated);
  } catch {
    // Allow scoring even if signing secret isn't set in local test runs.
  }

  const pillarNotes = Object.fromEntries(
    pillars.map((p) => [
      p,
      {
        score: signed.dimensions[p].score,
        strength: signed.dimensions[p].strength,
        weakness: signed.dimensions[p].weakness,
        fix: signed.dimensions[p].fix,
      },
    ]),
  ) as DesignerRedline["pillarNotes"];

  return {
    overall: signed.overall,
    evaluation: signed,
    feedCheck,
    designerRedline: {
      primaryFix:
        signed.suggestion ||
        signed.issues?.[0]?.instruction ||
        signed.dimensions[signed.priority]?.fix ||
        "No urgent visual changes flagged.",
      keep: signed.keep || [],
      keepText: signed.keepText || [],
      flags: signed.flags || [],
      pillarNotes,
    },
  };
}
