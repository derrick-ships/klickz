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
    personaId: z.string().uuid().nullable().optional(),
    styleId: z.string().uuid().nullable().optional(),
    style: z.string().max(120).default("Auto"),
    parentId: z.string().uuid().nullable().optional(),
    referencePath: z.string().max(400).nullable().optional(),
    referencePaths: z.array(z.string().max(400)).max(6).default([]),
    settings: settingsSchema.default({}),
    requestId: z.string().uuid(),
  })
  .superRefine((v, ctx) => {
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
export const ideaSchema = z.object({
  prompt: z.string().trim().min(8).max(2400),
  audience: z.string().max(200).default("YouTube viewers"),
});
export const reviewSchema = z
  .object({
    creationId: z.string().uuid().optional(),
    imagePath: z.string().max(400).optional(),
    title: z.string().trim().min(3).max(100),
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
export const observationSchema = z.object({
  summary: z.string(),
  dimensions: z.object(
    Object.fromEntries(
      pillars.map((p) => [
        p,
        z.object({
          observation: z.string(),
          strength: z.string(),
          weakness: z.string(),
          fix: z.string(),
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
});
export function parseScores(
  payload: unknown,
  observations?: z.infer<typeof observationSchema>,
  title = "",
): Evaluation {
  const { answers } = z
    .object({
      answers: z.record(
        z.object({
          score: z.number().min(0).max(3),
          confidence: z.number().min(0).max(1),
        }),
      ),
    })
    .parse(payload);
  if (pillars.some((p) => !answers[p]))
    throw new Error("Incomplete Jev evaluation");
  const dimensions = Object.fromEntries(
    pillars.map((p) => [
      p,
      {
        score: Math.round((answers[p].score / 3) * 100),
        confidence: answers[p].confidence,
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
    overall: Math.round(
      pillars.reduce((n, p) => n + dimensions[p].score, 0) / 5,
    ),
    priority: [...pillars].sort(
      (a, b) => dimensions[a].score - dimensions[b].score,
    )[0],
    title,
    note: "AI assessment of this image and title. Not measured CTR or a guarantee of views.",
    created_at: new Date().toISOString(),
  };
}
