import "server-only";
import sharp from "sharp";
import { adminDb } from "../admin-db";
import { ownedAsset } from "../assets";
import { callStructuredJson } from "../llm-router";
import type { PersistedMind } from "../schemas/audience";
import {
  mindPass1ResponseSchema,
  mindPass2BatchSchema,
  type DiagnosticQuestion,
} from "../schemas/study";
import {
  blindOrderForMind,
  buildMindPass1SystemPrompt,
  buildMindPass1UserPayload,
  mapBlindChoiceToCanonical,
  type OptionKey,
} from "./calibration-prompts";

export type PackagedOptionBrief = {
  option_key: OptionKey;
  title: string;
  image_path: string | null;
  jpg_path: string | null;
};

async function loadThumbPreview512(
  userId: string,
  opt: PackagedOptionBrief,
): Promise<Buffer> {
  const path = opt.jpg_path || opt.image_path;
  if (!path) throw new Error(`Missing image for option ${opt.option_key}`);
  const buf = await ownedAsset(adminDb(), userId, path);
  return sharp(buf, { limitInputPixels: 40000000 })
    .rotate()
    .resize({ width: 512, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/**
 * Pass 1: Runs a batch of 4 Minds independently in parallel.
 * Each Mind gets its own isolated multimodal call + randomized blind option order.
 */
export async function runMindsPass1Batch(params: {
  userId: string;
  studyRunId: string;
  language: string;
  opening60s: string;
  questions: DiagnosticQuestion[];
  options: PackagedOptionBrief[];
  mindsBatch: { mind: PersistedMind; globalIndex: number }[];
}): Promise<{ succeeded: number; failed: number }> {
  const db = adminDb();
  const byKey = new Map<OptionKey, PackagedOptionBrief>(
    params.options.map((o) => [o.option_key, o]),
  );

  // Load 512px preview buffers once per batch
  const thumbByKey = new Map<OptionKey, Buffer>();
  await Promise.all(
    (["A", "B", "C"] as const).map(async (k) => {
      const opt = byKey.get(k);
      if (opt) thumbByKey.set(k, await loadThumbPreview512(params.userId, opt));
    }),
  );

  const seedOffset =
    parseInt(params.studyRunId.replace(/-/g, "").slice(0, 4), 16) || 0;

  const outcomes = await Promise.allSettled(
    params.mindsBatch.map(async ({ mind, globalIndex }) => {
      const order = blindOrderForMind(globalIndex, seedOffset);
      const images = order
        .map((k) => thumbByKey.get(k))
        .filter((b): b is Buffer => !!b);
      const orderedOptions = order.map((k, idx) => ({
        label: String(idx + 1) as "1" | "2" | "3",
        title: byKey.get(k)?.title || "",
      }));

      const { data } = await callStructuredJson({
        role: "minds",
        schema: mindPass1ResponseSchema,
        images,
        maxTokens: 2000,
        timeoutMs: 75_000,
        system: buildMindPass1SystemPrompt(mind, params.language),
        userPrompt: buildMindPass1UserPayload({
          orderedOptions,
          opening60s: params.opening60s,
          questions: params.questions,
        }),
      });

      const canonicalChoice = mapBlindChoiceToCanonical(
        data.chosen_blind_label,
        order,
      );

      const up = await db.from("mind_responses").upsert(
        {
          study_run_id: params.studyRunId,
          mind_id: mind.id,
          user_id: params.userId,
          pass_number: 1,
          blind_option_order: order,
          chosen_option: canonicalChoice,
          click_confidence: data.click_confidence,
          verbatim_click_reason: data.verbatim_click_reason,
          top_hesitation_killer: data.top_hesitation_killer,
          question_answers: data.question_answers,
          retention_cliff_flag: data.retention_cliff_flag,
          retention_cliff_note: data.retention_cliff_note || null,
        },
        { onConflict: "study_run_id,mind_id,pass_number" },
      );
      if (up.error) throw up.error;
    }),
  );

  const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
  return { succeeded, failed: outcomes.length - succeeded };
}

/**
 * Pass 2: Comment-section skepticism & shareability stress-test across the panel.
 * Groups Minds into 2 cohorts of up to 8 so Minds react realistically to top critical objections.
 */
export async function runMindsPass2StressTest(params: {
  userId: string;
  studyRunId: string;
  language: string;
  opening60s: string;
  options: PackagedOptionBrief[];
  minds: PersistedMind[];
}): Promise<number> {
  const db = adminDb();
  const p1Res = await db
    .from("mind_responses")
    .select("*")
    .eq("study_run_id", params.studyRunId)
    .eq("pass_number", 1);
  const p1Rows = p1Res.data || [];

  const counts = { A: 0, B: 0, C: 0, none_keep_scrolling: 0 };
  for (const r of p1Rows) {
    const k = r.chosen_option as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  const topObjections = p1Rows
    .map((r) => String(r.top_hesitation_killer || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const leadingKey = (["A", "B", "C"] as ("A" | "B" | "C")[]).sort(
    (a, b) => counts[b] - counts[a],
  )[0];
  const leadingOpt = params.options.find((o) => o.option_key === leadingKey);

  const cohorts: PersistedMind[][] = [];
  for (let i = 0; i < params.minds.length; i += 8) {
    cohorts.push(params.minds.slice(i, i + 8));
  }

  let saved = 0;
  await Promise.all(
    cohorts.map(async (cohort) => {
      const { data } = await callStructuredJson({
        role: "minds",
        schema: mindPass2BatchSchema,
        maxTokens: 3200,
        timeoutMs: 90_000,
        system: `You are simulating Pass 2: a real YouTube comment section & word-of-mouth stress-test.
For each Mind below, simulate what happens when this video lands in their feed under the leading packaging option, they read the first 60s, and they see skeptical comments forming underneath.
ANTI-FLATTERY RULE: Be sharp, realistic, and unvarnished. Call out clickbait backlash, overpromising, fatigue, or retention drop-offs.
LANGUAGE RULE: Write every quote and assessment in natural "${params.language}".`,
        userPrompt: JSON.stringify({
          leadingOption: {
            key: leadingKey,
            title: leadingOpt?.title || "",
          },
          allOptionTitles: params.options.map((o) => ({
            key: o.option_key,
            title: o.title,
          })),
          pass1VoteSummary: counts,
          pass1TopSkepticismSignals: topObjections,
          opening60SecondsScript: params.opening60s,
          mindsInCohort: cohort.map((m) => ({
            mind_id: m.id,
            name: m.name,
            archetype: m.archetype,
            role: m.role,
            skepticism_triggers: m.skepticism_triggers,
            sample_voice_quote: m.sample_voice_quote,
          })),
          requiredJsonShape: {
            reactions: [
              {
                mind_id: "exact uuid from mindsInCohort",
                comment_skepticism_quote:
                  "Exact YouTube comment this Mind would write or upvote",
                shareability_score: "integer 1-10 (1 = never share, 10 = instant DM)",
                retention_cliff_flag: "boolean",
                retention_cliff_note: "specific reason viewer leaves early or empty string",
                trust_assessment: "1 sentence on whether channel trust grows or erodes",
              },
            ],
          },
        }),
      });

      const byMindId = new Map(p1Rows.map((r) => [r.mind_id as string, r]));
      const validIds = new Set(cohort.map((m) => m.id));
      const rows = data.reactions
        .filter((rx) => validIds.has(rx.mind_id))
        .map((rx) => {
          const p1 = byMindId.get(rx.mind_id);
          return {
            study_run_id: params.studyRunId,
            mind_id: rx.mind_id,
            user_id: params.userId,
            pass_number: 2,
            blind_option_order: p1?.blind_option_order ?? ["A", "B", "C"],
            chosen_option: p1?.chosen_option ?? "none_keep_scrolling",
            click_confidence: p1?.click_confidence ?? 5,
            verbatim_click_reason: rx.trust_assessment,
            top_hesitation_killer: p1?.top_hesitation_killer ?? "",
            question_answers: [],
            comment_skepticism_quote: rx.comment_skepticism_quote,
            shareability_score: rx.shareability_score,
            retention_cliff_flag: rx.retention_cliff_flag,
            retention_cliff_note: rx.retention_cliff_note || null,
          };
        });

      if (rows.length) {
        const up = await db
          .from("mind_responses")
          .upsert(rows, { onConflict: "study_run_id,mind_id,pass_number" });
        if (up.error) throw up.error;
        saved += rows.length;
      }
    }),
  );

  return saved;
}
