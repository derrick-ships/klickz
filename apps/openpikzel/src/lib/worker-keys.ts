import "server-only";
import { adminDb } from "./admin-db";
import { unseal } from "./crypto";
import {
  providerContext,
  type Provider,
  type ProviderKeys,
} from "./provider-context";
import {
  modelPreferenceContext,
  readModelPreferences,
  type ModelPreferences,
} from "./model-preferences";
import { AppError } from "./validation";

/**
 * Loads and decrypts a user's encrypted BYOK provider keys + model preferences
 * inside an async background worker (no interactive browser JWT required).
 */
export async function loadWorkerUserContext(userId: string): Promise<{
  keys: ProviderKeys;
  models: ModelPreferences;
  email: string | null;
}> {
  const db = adminDb();
  const [keysRes, userRes] = await Promise.all([
    db
      .from("studio_provider_keys")
      .select("provider,ciphertext")
      .eq("user_id", userId),
    db.auth.admin.getUserById(userId),
  ]);
  if (keysRes.error) {
    console.error("[worker-keys] studio_provider_keys query failed:", {
      code: keysRes.error.code,
      message: keysRes.error.message,
    });
    throw new AppError(
      503,
      `Could not load user provider keys in worker (${keysRes.error.code || "db_error"}).`,
    );
  }
  const keys: ProviderKeys = {};
  for (const row of keysRes.data || []) {
    const provider = row.provider as Provider;
    try {
      keys[provider] = unseal<{ key: string }>(
        row.ciphertext,
        `provider:${userId}:${provider}`,
      ).key;
    } catch {
      // Skip corrupted/stale ciphertext for an unrelated provider; required providers are validated explicitly.
    }
  }
  const user = userRes.data?.user;
  const models = readModelPreferences(user?.user_metadata);
  return {
    keys,
    models,
    email: user?.email ?? null,
  };
}

/**
 * Runs a background worker callback inside the user's decrypted BYOK providerContext
 * and modelPreferenceContext.
 */
export async function runWithWorkerUser<T>(
  userId: string,
  fn: (ctx: {
    keys: ProviderKeys;
    models: ModelPreferences;
    email: string | null;
  }) => Promise<T>,
): Promise<T> {
  const ctx = await loadWorkerUserContext(userId);
  return providerContext.run(ctx.keys, () =>
    modelPreferenceContext.run(ctx.models, () => fn(ctx)),
  );
}
