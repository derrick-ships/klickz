export type Mode =
  | "generate"
  | "recreate"
  | "edit"
  | "title"
  | "fix"
  | "resize";
export type ImageModel = "sunburst" | "flare";
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
  score: number;
  confidence: number;
  observation: string;
  strength: string;
  weakness: string;
  fix: string;
};
export type Evaluation = {
  source: "jev";
  version: 2;
  dimensions: Record<Pillar, Dimension>;
  overall: number;
  title: string;
  note: string;
  priority: Pillar;
  created_at: string;
};
export type Creation = {
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
  status: "draft" | "ready" | "failed" | "generating";
  created_at: string;
  titles?: string[];
  score?: Evaluation | null;
  settings?: Settings;
  request_id?: string;
  batch_id?: string;
  batch_index?: number;
};
export type Config = {
  cloud: boolean;
  ai: boolean;
  openai: boolean;
  jev: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  ownerGate: boolean;
};
