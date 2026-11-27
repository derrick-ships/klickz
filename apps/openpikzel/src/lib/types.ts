export type Mode =
  | "generate"
  | "recreate"
  | "edit"
  | "title"
  | "fix"
  | "resize";
export type ImageModel = "sunburst" | "flare" | "gemini-flash" | "gemini-pro";
export type TextProvider = "openai" | "google";
export type Quality = "low" | "medium" | "high" | "xhigh" | "max";
export type Complexity = "low" | "medium" | "high";
export type Format = "long" | "short";
export type Settings = {
  model: ImageModel;
  quality: Quality;
  complexity: Complexity;
  format: Format;
  /** Images per click. 8 and 16 are sent as chunks of 4 (each request is capped at 4 provider calls). */
  batch: 1 | 2 | 4 | 8 | 16;
};
export const defaultSettings: Settings = {
  model: "flare",
  quality: "medium",
  complexity: "medium",
  format: "long",
  batch: 1,
};
export type Persona = {
  id: string;
  name: string;
  notes: string;
  refs: string[];
  created_at: string;
  profile_status?: "draft" | "ready";
  identity_brief?: string;
  tone_of_voice?: string;
  visual_style_rules?: string;
  default_style_id?: string | null;
};
export type Style = {
  id: string;
  name: string;
  notes: string;
  refs: string[];
  created_at: string;
  profile_status?: "draft" | "ready";
  identity_brief?: string;
  source?: { kind?: "youtube"; channelId?: string; videoIds?: string[]; palette?: string[] };
};
export const pillars = [
  "virality",
  "clarity",
  "idea",
  "curiosity",
  "emotion",
] as const;
export type Pillar = (typeof pillars)[number];
/** Fixed review-flag vocabulary per pillar (Pikzels-style booleans; only TRUE flags are stored). */
export const pillarFlagVocabulary = {
  clarity: ["tiny_text", "low_contrast_text", "competing_elements", "text_blocks_face_or_subject", "too_many_words"],
  idea: ["depends_on_title", "cliche_or_generic", "text_repeats_title"],
  curiosity: ["spoiler_present", "mixed_or_confusing_hook", "deceptive_bait_risk"],
  emotion: ["no_readable_emotion", "mixed_signals", "text_obscures_expression"],
  virality: ["fatigued_format", "platform_safety_risk"],
} as const satisfies Record<Pillar, readonly string[]>;
export const globalFlagVocabulary = ["real_person_without_reference", "invented_numbers", "logo_or_date_present"] as const;
export type PillarFlag = (typeof pillarFlagVocabulary)[Pillar][number];
export type GlobalFlag = (typeof globalFlagVocabulary)[number];
export type ReviewFlag = PillarFlag | GlobalFlag;
/** One previous One-Click Fix on this lineage and the overall score before/after it (after null = not scored yet). */
export type FixHistoryEntry = { suggestion: string; before: number | null; after: number | null };
/** Returned by /api/analyze when the analysed creation is the result of a fix. */
export type ScoreComparison = { improved: boolean; before: number; after: number; bestId: string };
export type Dimension = {
  score: number | null;
  missingReason?: string;
  confidence: number;
  observation: string;
  strength: string;
  weakness: string;
  fix: string;
  generalAdvice?: boolean;
  /** TRUE flags only, from pillarFlagVocabulary[pillar]. Absent on older scores. */
  flags?: PillarFlag[];
  /** Up to three concrete edits for this pillar; fix === suggestions[0] when present. */
  suggestions?: string[];
  /** The scorer's probability for each level ("0".."3"), as returned. Kept to review and retune thresholds. */
  probabilities?: Record<string, number>;
};
export type Evaluation = {
  source: "jev";
  version: 2 | 3;
  dimensions: Record<Pillar, Dimension>;
  overall: number | null;
  partial?: boolean;
  sourceDigest?: string;
  inputDigest?: string;
  rubricVersion?: string;
  instructionVersion?: string;
  context?: { title: string; videoBrief: string; audience: string };
  preview?: { width: number; height: number; digest: string };
  vision?: boolean;
  contributors?: { provider: string; model: string; role: "scoring" | "image-review" }[];
  /** The exact model id Jev reported for this score (e.g. "jev-1.14.0"). */
  jev?: { model: string };
  /** Which scorers were tried, in order, and which one gave the numbers; kept to review fallbacks and thresholds. */
  scoring?: {
    route: { scorer: "jev" | "openai" | "anthropic" | "google"; outcome: "scored" | "failed"; reason?: string }[];
    model: string;
    flagProbabilities?: Partial<Record<ReviewFlag, number>>;
    /** Probability that the title, facts or image text try to instruct the scorer (recorded for review only). */
    injection?: number;
  };
  videoEvidence?: { url: string; kind: "youtube-description" | "unavailable"; notice: string };
  evidence?: {
    id: string;
    pillar: Pillar;
    asset: "original" | "preview";
    statement: string;
  }[];
  issues?: {
    id: string;
    pillar: Pillar;
    evidenceIds: string[];
    instruction: string;
    tradeoff: string;
  }[];
  warnings?: string[];
  /** Flags that are not tied to one pillar (only TRUE ones). */
  globalFlags?: GlobalFlag[];
  /** Every TRUE flag, flattened, for display. */
  flags?: { pillar: Pillar | "global"; flag: ReviewFlag }[];
  /** Fixed points subtracted from the mean for serious flags (only when the image review ran). */
  penalties?: { flag: ReviewFlag; points: number }[];
  /** round(mean of pillar scores) after pillar caps, before penalties. overall = clamp(this - sum(penalties)). */
  meanBeforePenalties?: number | null;
  /** The single One-Click Fix instruction: fixes only what is flagged and names what to keep (<=300 chars). */
  suggestion?: string;
  /** Things that work and must not change (face, its side, colours, the on-image text…). */
  keep?: string[];
  /** Exact on-image wording to keep verbatim (subset of what keep describes). */
  keepText?: string[];
  /** On-image text the reviewer read, if any. */
  readableText?: string | null;
  /** Previous fixes on this lineage that were shown to the reviewer. */
  fixHistory?: FixHistoryEntry[];
  fixBlocked?: boolean;
  /** No title or intended promise: Idea and Curiosity were judged from the image alone. */
  imageOnly?: boolean;
  proof?: string;
  title: string;
  note: string;
  priority: Pillar;
  created_at: string;
};
export type Creation = {
  conversation_id?: string | null;
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  style: string;
  persona_id: string | null;
  style_id?: string | null;
  reference_path?: string | null;
  reference_paths?: string[];
  image_path: string | null;
  parent_id: string | null;
  favorite: boolean;
  status: "draft" | "ready" | "failed" | "generating" | "reconciling";
  created_at: string;
  titles?: string[];
  score?: Evaluation | null;
  settings?: Settings;
  request_id?: string;
  batch_id?: string;
  batch_index?: number;
  lineage?: { elementIds?: string[]; elementReferencePaths?: string[]; personaIds?: string[]; origin?:"generated"|"edited"|"recomposed"|"uploaded"|"layout";nativeOutput?:boolean;sourceId?: string; sourceDigest?: string; fixPlanHash?: string; mediator?: import("./mediator").MediatorRecord; plan?: unknown; fix?: { suggestion: string; keep: string[]; keepText?: string[]; parentScore: number | null; history?: FixHistoryEntry[] } };
  review?: { preference: string; order: string[]; decidedAt: string };
};
export type Config = {
  connectionStatus?:"loading"|"ready"|"failed";
  promptModel?: string;
  cloud: boolean;
  ai: boolean;
  openai: boolean;
  jev: boolean;
  anthropic: boolean;
  google?: boolean;
  youtube?: boolean;
  transcript?: boolean;
  secureConnections?: boolean;
  higgsfield?: boolean;
  codexDevice?: boolean;
  textModels?: {openai:string;google:string};
  scoreModel?: string;
  models?: import("./model-preferences").ModelPreferences;
  mcpUrl?: string;
  supabaseUrl: string;
  supabaseKey: string;
  ownerGate: boolean;
};
