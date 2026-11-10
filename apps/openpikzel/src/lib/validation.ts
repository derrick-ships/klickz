import { z } from "zod";
import { pillars, type Evaluation } from "./types";
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
    styleId: z.string().uuid().nullable().optional(),
    style: z.string().max(120).default("Auto"),
    parentId: z.string().uuid().nullable().optional(),
    referencePath: z.string().max(400).nullable().optional(),
    referencePaths: z.array(z.string().max(400)).max(6).default([]),
    settings: settingsSchema.default({}),
    requestId: z.string().uuid(),
    fixPlanToken: z.string().max(32000).optional(),
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
export const observationSchema = z
  .object({
    summary: z.string().max(3000),
    promiseConflict: z.boolean().default(false),
    readableText: z.string().max(2000).nullable().default(null),
    dimensions: z.object(
      Object.fromEntries(
        pillars.map((p) => [
          p,
          z.object({
            observation: z.string().max(1500),
            strength: z.string().max(1500),
            weakness: z.string().max(1500),
            fix: z.string().max(1500),
          }),
        ]),
      ) as Record<
        (typeof pillars)[number],
        z.ZodObject<{
          observation: z.ZodString;
          strength: z.ZodString;
          weakness: z.ZodString;
          fix: z.ZodString;
        }>
      >,
    ),
  })
  .strict();
export function parseScores(
  payload: unknown,
  observations?: z.infer<typeof observationSchema>,
  title = "",
): Evaluation {
  const { answers } = z
    .object({
      answers: z.record(
        z.object({
          score: z.number().min(0).max(3).nullable(),
          confidence: z.number().min(0).max(1),
        }),
      ),
    })
    .parse(payload);

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
        observation: observations?.dimensions[p].observation || "",
        strength: observations?.dimensions[p].strength || "",
        weakness: observations?.dimensions[p].weakness || "",
        fix: observations?.dimensions[p].fix || "",
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
    note: "AI assessment of this image and title. Not measured CTR or a guarantee of views.",
    created_at: new Date().toISOString(),
  };
}
