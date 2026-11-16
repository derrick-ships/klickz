import { z } from "zod";
import { pillars, pillarFlagVocabulary, globalFlagVocabulary, type Evaluation, type Pillar, type PillarFlag, type GlobalFlag } from "./types";
export const settingsSchema = z.object({
  model: z
    .enum(["sunburst", "flare", "gemini-flash", "gemini-pro"])
    .default("flare"),
  quality: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  complexity: z.enum(["low", "medium", "high"]).default("medium"),
  format: z.enum(["long", "short"]).default("long"),
  batch: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
});
export const generationSchema = z
  .object({
    prompt: z.string().trim().min(8).max(2400),
    title: z.string().trim().max(100).default(""),
    mode: z.enum(["generate", "recreate", "edit", "title", "fix"]),
    intent: z.enum(["create","recompose"]).default("create"),
    conversationId: z.string().uuid().nullable().optional(),
    personaId: z.string().uuid().nullable().optional(),
    /** Up to three personas in one thumbnail (the composer's @mentions). personaId is the older single form. */
    personaIds: z.array(z.string().uuid()).max(3).default([]),
    styleId: z.string().uuid().nullable().optional(),
    style: z.string().max(120).default("Auto"),
    parentId: z.string().uuid().nullable().optional(),
    referencePath: z.string().max(400).nullable().optional(),
    referencePaths: z.array(z.string().max(400)).max(6).default([]),
    settings: settingsSchema.default({}),
    requestId: z.string().uuid(),
    fixPlanToken: z.string().max(32000).optional(),
    /** Large batches (8, 16) arrive as chunks of 4; this keeps each image's variation number unique. */
    variationOffset: z.number().int().min(0).max(15).default(0),
    /** A pre-made style from the library (public/styles). */
    libraryStyleId: z.string().max(60).nullable().optional(),
    variationTotal: z.number().int().min(1).max(16).default(1),
  })
  .superRefine((v, ctx) => {
    if(v.intent==="recompose"&&(v.mode!=="edit"||!v.parentId||v.settings.batch!==1))ctx.addIssue({code:"custom",message:"Recomposition creates one new edit from an owned source.",path:["intent"]});
    if (["edit", "fix"].includes(v.mode) && !v.parentId && !v.referencePath)
      ctx.addIssue({
        code: "custom",
        message: "Choose an image to edit",
        path: ["parentId"],
      });
    if (v.mode === "recreate" && !v.referencePath && !v.referencePaths.length)
      ctx.addIssue({
        code: "custom",
        message: "Add a composition reference",
        path: ["referencePath"],
      });
  });
export const textProviderSchema = z.enum(["openai", "google"]).default("openai");
export const visionProviderSchema = z.enum(["anthropic", "openai", "google"]).default("openai");
export const ideaSchema = z.object({
  provider: textProviderSchema,
  prompt: z.string().trim().min(8).max(2400),
  audience: z.string().max(200).default("YouTube viewers"),
});
export const reviewSchema = z
  .object({
    creationId: z.string().uuid().optional(),
    imagePath: z.string().max(400).optional(),
    title: z.string().trim().max(100).default(""),
    videoBrief: z.string().trim().max(2400).default(""),
    videoUrl: z.string().trim().max(500).default(""),
    audience: z.string().trim().max(200).default(""),
    includeVision: z.boolean().default(false),
    rescore: z.boolean().default(false),
    critiqueProvider: visionProviderSchema,
    requestId: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
  })
  .refine((x) => x.creationId || x.imagePath, "Choose a thumbnail");
export function ownedPath(path: string, userId: string) {
  return (
    path.startsWith(userId + "/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !path.includes("%")
  );
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
/** Keep only known flags (unknown ones are dropped, not rejected) and de-duplicate. */
const flagList = <T extends readonly [string, ...string[]]>(vocabulary: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? [...new Set(value.filter((v) => typeof v === "string" && (vocabulary as readonly string[]).includes(v)))] : []),
    z.array(z.enum(vocabulary)),
  );
const clip = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, max) : v), z.string());
const shortList = (max: number, itemMax: number) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()).map((v: string) => v.trim().slice(0, itemMax)).slice(0, max) : []),
    z.array(z.string()),
  );
const dimensionSchema = (p: Pillar) =>
  z
    .object({
      observation: z.string().max(1500),
      strength: z.string().max(1500),
      weakness: z.string().max(1500),
      fix: z.string().max(1500),
      flags: flagList(pillarFlagVocabulary[p] as unknown as [string, ...string[]]).default([]),
      suggestions: shortList(3, 600).default([]),
    })
    .transform((d) => ({ ...d, flags: d.flags as PillarFlag[], fix: d.suggestions[0] || d.fix }));
export const observationSchema = z
  .object({
    summary: z.string().max(3000),
    promiseConflict: z.boolean().default(false),
    readableText: z.string().max(2000).nullable().default(null),
    dimensions: z.object(
      Object.fromEntries(pillars.map((p) => [p, dimensionSchema(p)])) as Record<Pillar, ReturnType<typeof dimensionSchema>>,
    ),
    globalFlags: flagList(globalFlagVocabulary as unknown as [string, ...string[]]).default([]),
    /** One edit instruction that fixes only what is flagged and names what to keep. */
    suggestion: clip(300).default(""),
    /** What works and must not change. */
    keep: shortList(8, 160).default([]),
    /** Exact on-image wording that must stay verbatim. */
    keepText: shortList(4, 80).default([]),
  })
  .strict()
  .transform((o) => ({ ...o, globalFlags: o.globalFlags as GlobalFlag[] }));
export type Observations = z.infer<typeof observationSchema>;
/** JSON Schema for OpenAI Structured Outputs (strict): every key required, no extras. */
export const observationJsonSchema = (() => {
  const str = { type: "string" };
  const list = { type: "array", items: str };
  const dimension = (p: Pillar) => ({
    type: "object",
    properties: {
      observation: str,
      strength: str,
      weakness: str,
      fix: str,
      flags: { type: "array", items: { type: "string", enum: [...pillarFlagVocabulary[p]] } },
      suggestions: list,
    },
    required: ["observation", "strength", "weakness", "fix", "flags", "suggestions"],
    additionalProperties: false,
  });
  return {
    type: "object",
    properties: {
      summary: str,
      promiseConflict: { type: "boolean" },
      readableText: { type: ["string", "null"] },
      dimensions: {
        type: "object",
        properties: Object.fromEntries(pillars.map((p) => [p, dimension(p)])),
        required: [...pillars],
        additionalProperties: false,
      },
      globalFlags: { type: "array", items: { type: "string", enum: [...globalFlagVocabulary] } },
      suggestion: str,
      keep: list,
      keepText: list,
    },
    required: ["summary", "promiseConflict", "readableText", "dimensions", "globalFlags", "suggestion", "keep", "keepText"],
    additionalProperties: false,
  };
})();
/** One pillar's Score answer as Jev documents it; extra fields are ignored. */
const pillarAnswerSchema = z.object({
  score: z.number().min(0).max(3).nullable(),
  confidence: z.number().min(0).max(1).default(0),
  probabilities: z.record(z.number().min(0).max(1)).optional(),
});
/**
 * Read the five pillar Score answers from a Jev (or reviewer-model) reply. The same reply also carries one
 * Noul per review flag and may carry other answers; only the pillars are read here (flags: readJevFlags),
 * and a missing or malformed pillar becomes "not assessed" instead of failing the whole score.
 */
export function parseScores(
  payload: unknown,
  observations?: Observations,
  title = "",
): Evaluation {
  const record = (payload && typeof payload === "object" ? payload : {}) as { answers?: unknown; model?: unknown };
  const raw = (record.answers && typeof record.answers === "object" ? record.answers : {}) as Record<string, unknown>;
  const answers: Partial<Record<Pillar, z.infer<typeof pillarAnswerSchema>>> = {};
  for (const p of pillars) {
    const parsed = pillarAnswerSchema.safeParse(raw[p]);
    if (parsed.success) answers[p] = parsed.data;
  }
  if (!pillars.some((p) => typeof answers[p]?.score === "number"))
    throw Object.assign(new AppError(502, "The scorer returned no usable pillar scores."), { scorerStatus: "unreadable response" });
  const dimensions = Object.fromEntries(
    pillars.map((p) => [
      p,
      {
        score:
          answers[p]?.score == null
            ? null
            : Math.round((answers[p].score! / 3) * 100),
        ...(answers[p]?.score == null
          ? { missingReason: "Provider did not assess this pillar." }
          : {}),
        confidence: answers[p]?.confidence || 0,
        ...(answers[p]?.probabilities ? { probabilities: answers[p]!.probabilities } : {}),
        observation: observations?.dimensions[p].observation || "",
        strength: observations?.dimensions[p].strength || "",
        weakness: observations?.dimensions[p].weakness || "",
        fix: observations?.dimensions[p].fix || "",
        ...(observations ? { flags: observations.dimensions[p].flags, suggestions: observations.dimensions[p].suggestions } : {}),
      },
    ]),
  ) as Evaluation["dimensions"];
  return {
    source: "jev",
    version: 2,
    dimensions,
    overall: pillars.some((p) => dimensions[p].score === null)
      ? null
      : Math.round(pillars.reduce((n, p) => n + dimensions[p].score!, 0) / 5),
    priority: [...pillars].sort(
      (a, b) => (dimensions[a].score ?? 100) - (dimensions[b].score ?? 100),
    )[0],
    title,
    ...(observations
      ? {
          globalFlags: observations.globalFlags,
          readableText: observations.readableText,
          ...(observations.suggestion ? { suggestion: observations.suggestion } : {}),
          keep: observations.keep,
          keepText: observations.keepText,
        }
      : {}),
    ...(typeof record.model === "string" ? { jev: { model: record.model.slice(0, 80) } } : {}),
    note: "AI assessment of this image and title. Not measured CTR or a guarantee of views.",
    created_at: new Date().toISOString(),
  };
}
