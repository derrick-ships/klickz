import { AsyncLocalStorage } from "node:async_hooks";
import { unseal } from "./crypto";
import { AppError } from "./validation";
import type { SupabaseClient } from "@supabase/supabase-js";
export type Provider = "openai" | "jev" | "google" | "youtube";
export type ProviderKeys = Partial<Record<Provider, string>>;
export const providerContext = new AsyncLocalStorage<ProviderKeys>();
export function providerKey(provider: Provider) {
  const key = providerContext.getStore()?.[provider];
  if (!key)
    throw new AppError(
      403,
      `Connect your own ${provider === "google" ? "Google" : provider === "jev" ? "Jev" : "OpenAI"} API key in Connections.`,
    );
  return key;
}
export function hasProvider(provider: Provider) {
  return !!providerContext.getStore()?.[provider];
}
export async function userKeys(db: SupabaseClient, userId: string) {
  const result = await db
    .from("studio_provider_keys")
    .select("provider,ciphertext")
    .eq("user_id", userId);
  if (result.error)
    throw new AppError(503, "Provider connections are not ready.");
  const keys: ProviderKeys = {};
  for (const row of result.data || []) {
    const provider = row.provider as Provider;
    keys[provider] = unseal<{ key: string }>(
      row.ciphertext,
      `provider:${userId}:${provider}`,
    ).key;
  }
  // Owner environment keys are explicitly gated; they are never a fallback for other accounts.
  if (process.env.OWNER_PROVIDER_KEYS === "true") {
    const owner = await db.rpc("app_web_access");
    if (!owner.error && owner.data === true) {
      keys.openai ||= process.env.OPENAI_API_KEY;
      keys.jev ||= process.env.JEV_API_KEY;
    }
  }
  return keys;
}
