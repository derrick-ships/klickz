import { z } from "zod";
import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "./validation";
import type { VisionProvider } from "./vision-provider";

// Which model does each job. Saved per user (auth user_metadata.openpikzels_models).
// "Latest" choices are aliases: they resolve to the newest matching model the user's
// own key can see, so a new release is picked up without a code change.

export type ModelAlias = {
  id: string;
  label: string;
  provider: VisionProvider;
  /** Model ids of this family, e.g. /^claude-opus-\d/. */
  family: RegExp;
  /** Used when the provider's model list can't be read. */
  fallback: string;
};

export const textAliases: ModelAlias[] = [
  { id: "opus-latest", label: "Claude Opus (latest)", provider: "anthropic", family: /^claude-opus-\d/, fallback: "claude-opus-5-5" },
  { id: "sonnet-latest", label: "Claude Sonnet (latest)", provider: "anthropic", family: /^claude-sonnet-\d/, fallback: "claude-sonnet-5-5" },
  { id: "haiku-latest", label: "Claude Haiku (latest)", provider: "anthropic", family: /^claude-haiku-\d/, fallback: "claude-haiku-5-5" },
  { id: "gpt-sol-latest", label: "GPT Sol (latest)", provider: "openai", family: /^gpt-\d+(\.\d+)?-sol$/, fallback: "gpt-6.1-sol" },
  { id: "gpt-terra-latest", label: "GPT Terra (latest)", provider: "openai", family: /^gpt-\d+(\.\d+)?-terra$/, fallback: "gpt-6.1-terra" },
  { id: "gpt-luna-latest", label: "GPT Luna (latest)", provider: "openai", family: /^gpt-\d+(\.\d+)?-luna$/, fallback: "gpt-6-luna" },
  { id: "gemini-pro-latest", label: "Gemini Pro (latest)", provider: "google", family: /^gemini-\d+(\.\d+)?-pro$/, fallback: "gemini-3-pro" },
  { id: "gemini-flash-latest", label: "Gemini Flash (latest)", provider: "google", family: /^gemini-\d+(\.\d+)?-flash$/, fallback: "gemini-3.5-flash" },
];

export const scorers = [
  { id: "jev", label: "Jev (TypeSafe)" },
  { id: "model", label: "Same model as the reviewer" },
] as const;

export const imageGenerators = ["flare", "sunburst", "gemini-flash", "gemini-pro"] as const;

export const modelPreferencesSchema = z.object({
  /** Looks at the image and writes the fix. Default: Claude Sonnet (latest, Sonnet 5.5 today). */
  reviewer: z.string().max(40).default("sonnet-latest"),
  /** Who gives the five numbers. */
  scorer: z.enum(["jev", "model"]).default("jev"),
  /** Rewrites the prompt before every image. "auto" = OpenAI, else Google. */
  mediator: z.string().max(40).default("gpt-sol-latest"),
  /** Default image model for Create. */
  image: z.enum(imageGenerators).default("flare"),
});
export type ModelPreferences = z.infer<typeof modelPreferencesSchema>;
export const defaultModelPreferences: ModelPreferences = modelPreferencesSchema.parse({});

export function readModelPreferences(metadata: unknown): ModelPreferences {
  const raw = (metadata as { openpikzels_models?: unknown } | null)?.openpikzels_models;
  const parsed = modelPreferencesSchema.safeParse(raw ?? {});
  if (!parsed.success) return defaultModelPreferences;
  // "auto" used to mean gpt-5.5 for the prompt writer and "first connected provider" for the
  // reviewer. Those two jobs now default to GPT Sol and Claude Sonnet respectively.
  const mediator = parsed.data.mediator === "auto" ? "gpt-sol-latest" : parsed.data.mediator;
  const reviewer = parsed.data.reviewer === "auto" ? "sonnet-latest" : parsed.data.reviewer;
  return { ...parsed.data, mediator, reviewer };
}

export const aliasById = (id: string) => textAliases.find((a) => a.id === id);

/** Newest id in a family: higher version number wins, then the undated alias over dated snapshots. */
export function newestInFamily(ids: string[], family: RegExp): string | null {
  const matches = ids.filter((id) => family.test(id));
  if (!matches.length) return null;
  const version = (id: string) => (id.match(/(\d+(?:[.-]\d+)*)/)?.[1] || "0").split(/[.-]/).map(Number);
  return matches.sort((a, b) => {
    const va = version(a), vb = version(b);
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
      const d = (vb[i] ?? -1) - (va[i] ?? -1);
      if (d) return d;
    }
    return a.length - b.length;
  })[0];
}

type Lister = (provider: VisionProvider, key: string) => Promise<string[]>;

export const listProviderModels: Lister = async (provider, key) => {
  const timeout = AbortSignal.timeout(8000);
  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + key }, signal: timeout });
    if (!r.ok) throw new AppError(r.status, "OpenAI models unavailable");
    return ((await r.json()).data || []).map((m: { id: string }) => m.id);
  }
  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, signal: timeout });
    if (!r.ok) throw new AppError(r.status, "Claude models unavailable");
    return ((await r.json()).data || []).map((m: { id: string }) => m.id);
  }
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: timeout });
  if (!r.ok) throw new AppError(r.status, "Google models unavailable");
  return ((await r.json()).models || []).map((m: { name: string }) => m.name.replace(/^models\//, ""));
};

const cache = new Map<string, { at: number; ids: string[] }>();
/** Resolve an alias to a concrete model id visible to this key (cached 10 minutes per key). */
export async function resolveAlias(alias: ModelAlias, key: string, list: Lister = listProviderModels) {
  const cacheKey = alias.provider + ":" + key.slice(-12);
  let entry = cache.get(cacheKey);
  if (!entry || Date.now() - entry.at > 600000) {
    try {
      entry = { at: Date.now(), ids: await list(alias.provider, key) };
      cache.set(cacheKey, entry);
    } catch {
      return { model: alias.fallback, resolved: false };
    }
  }
  const newest = newestInFamily(entry.ids, alias.family);
  return newest ? { model: newest, resolved: true } : { model: alias.fallback, resolved: false };
}
export const clearModelCache = () => cache.clear();

/** The signed-in user's model choices for the current request. */
export const modelPreferenceContext = new AsyncLocalStorage<ModelPreferences>();
export const currentModelPreferences = () => modelPreferenceContext.getStore() ?? defaultModelPreferences;

/**
 * Concrete model for a text/vision job. A chosen alias wins when its provider key is
 * connected; otherwise the provider's existing default (env or built-in) is used.
 */
export async function modelFor(choice: string, provider: VisionProvider, key: string | undefined, fallback: string) {
  const alias = aliasById(choice);
  if (!alias || alias.provider !== provider || !key) return fallback;
  return (await resolveAlias(alias, key)).model;
}
export { providerOfChoice } from "./model-choice";
