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
  batch: 1 | 2 | 4;
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
};
export type Style = {
  id: string;
  name: string;
  notes: string;
  refs: string[];
  created_at: string;
  profile_status?: "draft" | "ready";
  identity_brief?: string;
};
export const pillars = [
  "virality",
  "clarity",
  "idea",
  "curiosity",
  "emotion",
] as const;
export type Pillar = (typeof pillars)[number];
export type Dimension = {
  score: number | null;
  missingReason?: string;
  confidence: number;
  observation: string;
  strength: string;
  weakness: string;
  fix: string;
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
  fixBlocked?: boolean;
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
  lineage?: { origin?:"generated"|"edited"|"recomposed"|"uploaded"|"layout";nativeOutput?:boolean;sourceId?: string; sourceDigest?: string; fixPlanHash?: string };
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
  secureConnections?: boolean;
  higgsfield?: boolean;
  codexDevice?: boolean;
  textModels?: {openai:string;google:string};
  scoreModel?: string;
  mcpUrl?: string;
  supabaseUrl: string;
  supabaseKey: string;
  ownerGate: boolean;
};
