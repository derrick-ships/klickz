import { z } from "zod";

export const mindArchetypes = [
  "loyalist",
  "casual_scroller",
  "skeptic",
  "new_viewer",
] as const;
export type MindArchetype = (typeof mindArchetypes)[number];

export const audienceDistributionSchema = z.object({
  primary_language: z.string().min(2).max(12),
  audience_summary: z.string().min(20).max(1200),
  demographics: z.object({
    age_bands: z
      .array(z.object({ label: z.string(), share_pct: z.number().min(0).max(100) }))
      .min(2)
      .max(6),
    geo_and_culture: z.string().min(5).max(400),
    viewer_tenure_split: z.string().min(5).max(400),
  }),
  psychographics: z.object({
    core_motivations: z.array(z.string().min(3).max(200)).min(3).max(7),
    recurring_pain_points: z.array(z.string().min(3).max(200)).min(3).max(7),
    skepticism_patterns: z.array(z.string().min(3).max(200)).min(3).max(7),
    tone_preferences: z.string().min(5).max(400),
  }),
  comment_themes: z
    .array(
      z.object({
        theme: z.string().min(2).max(120),
        sentiment: z.enum(["positive", "critical", "curious", "debated"]),
        example_signal: z.string().min(5).max(240),
      }),
    )
    .min(3)
    .max(8),
  outlier_patterns: z.object({
    what_wins: z.array(z.string().min(5).max(240)).min(2).max(6),
    what_flops: z.array(z.string().min(5).max(240)).min(2).max(6),
    winning_title_mechanics: z.array(z.string().min(5).max(200)).min(2).max(6),
  }),
});
export type AudienceDistribution = z.infer<typeof audienceDistributionSchema>;

export const audienceMindItemSchema = z.object({
  name: z.string().min(2).max(80),
  role: z.string().min(3).max(160),
  archetype: z.enum(mindArchetypes),
  age_bracket: z.string().min(2).max(32),
  click_bar: z.number().int().min(1).max(10),
  knowledge_items: z.array(z.string().min(4).max(220)).min(3).max(6),
  thinking_patterns: z.array(z.string().min(4).max(220)).min(2).max(4),
  skepticism_triggers: z.array(z.string().min(4).max(220)).min(2).max(4),
  sample_voice_quote: z.string().min(8).max(280),
});
export type AudienceMindDraft = z.infer<typeof audienceMindItemSchema>;

export const mindBatchSchema = z.object({
  minds: z.array(audienceMindItemSchema).min(6).max(10),
});

export type PersistedMind = AudienceMindDraft & {
  id: string;
  audience_id: string;
  sort_order: number;
  avatar_seed: string;
  active: boolean;
};

export const mindPatchSchema = z.object({
  mindId: z.string().uuid(),
  active: z.boolean().optional(),
  name: z.string().trim().min(2).max(80).optional(),
  role: z.string().trim().min(3).max(160).optional(),
  click_bar: z.number().int().min(1).max(10).optional(),
  skepticism_triggers: z.array(z.string().trim().min(3).max(220)).min(1).max(6).optional(),
  thinking_patterns: z.array(z.string().trim().min(3).max(220)).min(1).max(6).optional(),
});
