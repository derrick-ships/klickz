import { imageOutputEstimate } from "./provider-cost";
import { defaultSettings, type Settings } from "./types";

export type StudyCostInput = {
  mindsCount: number;
  questionsCount: number;
  hasDraftThumbnail: boolean;
  scriptChars: number;
  imageSettings?: Settings;
  mindsModel?: string;
  strategistModel?: string;
};

export type StudyCostEstimate = {
  syntheticResponses: number;
  imageRenders: number;
  estimatedUsdMin: number;
  estimatedUsdMax: number;
  summary: string;
  breakdown: { label: string; estimateUsd: number }[];
};

function isFlagshipTextModel(model?: string) {
  if (!model) return false;
  return /opus|pro|6\.2|sol|terra|5\.5|sonnet/i.test(model);
}

/**
 * Honest upfront API cost estimator for BYOK Pre-Flight Studies.
 * Covers Leg A (2 or 3 thumbnails + 3 vision/decision scores),
 * Leg B (Pass 1 cold multimodal + Pass 2 comment stress-test),
 * and Leg C (full-script editorial strategist).
 */
export function estimateStudyCost(input: StudyCostInput): StudyCostEstimate {
  const minds = Math.max(12, Math.min(16, Math.round(input.mindsCount)));
  const questions = Math.max(6, Math.min(8, Math.round(input.questionsCount)));
  const syntheticResponses = minds * questions;
  const imageRenders = input.hasDraftThumbnail ? 2 : 3;

  const settings: Settings = {
    ...(input.imageSettings ?? defaultSettings),
    batch: 1,
  };
  const perImage = imageOutputEstimate(settings).perImage;
  const legAImages = perImage * imageRenders;
  const legAScoringAndConcept = 0.12;

  const perMindCall = isFlagshipTextModel(input.mindsModel) ? 0.045 : 0.012;
  // Pass 1 (16 multimodal calls) + Pass 2 (4 cohort stress-test calls)
  const legB = minds * perMindCall + 4 * perMindCall * 0.8;

  const scriptKTokens = Math.max(1, Math.ceil(input.scriptChars / 4000));
  const strategistRate = isFlagshipTextModel(input.strategistModel) ? 0.03 : 0.012;
  const legC = Math.max(0.06, scriptKTokens * strategistRate + 0.06);

  const subtotal = legAImages + legAScoringAndConcept + legB + legC;
  const estimatedUsdMin = Math.max(0.15, Math.round(subtotal * 0.8 * 100) / 100);
  const estimatedUsdMax = Math.max(
    estimatedUsdMin + 0.15,
    Math.round(subtotal * 1.35 * 100) / 100,
  );

  return {
    syntheticResponses,
    imageRenders,
    estimatedUsdMin,
    estimatedUsdMax,
    summary: `${minds} Minds × ${questions} Questions = ${syntheticResponses} synthetic responses · ${imageRenders} AI thumbnails · Est. $${estimatedUsdMin.toFixed(2)}–$${estimatedUsdMax.toFixed(2)} on your connected AI keys`,
    breakdown: [
      {
        label: `Leg A — ${imageRenders} AI renders + 3 packaging scores`,
        estimateUsd: Math.round((legAImages + legAScoringAndConcept) * 100) / 100,
      },
      {
        label: `Leg B — ${minds} Minds (Pass 1 cold + Pass 2 skepticism)`,
        estimateUsd: Math.round(legB * 100) / 100,
      },
      {
        label: "Leg C — Full-script editorial strategist",
        estimateUsd: Math.round(legC * 100) / 100,
      },
    ],
  };
}
