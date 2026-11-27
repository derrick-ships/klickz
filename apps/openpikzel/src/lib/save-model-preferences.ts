import "server-only";
import type { User } from "@supabase/supabase-js";
import { adminDb } from "./admin-db";
import { publicSupabaseConfig } from "./config";
import type { ModelPreferences } from "./model-preferences";
import { AppError } from "./validation";

/**
 * Persist user model preferences in auth.users.user_metadata.
 *
 * Uses Supabase Admin API (service role) because stateless server clients created with
 * `persistSession: false` and a Bearer header do not hold an internal GoTrue session,
 * causing `db.auth.updateUser()` to fail with AuthSessionMissingError.
 * Falls back to direct GoTrue REST `PUT /auth/v1/user` when a user JWT is provided and
 * service-role credentials are unavailable.
 */
export async function saveUserModelPreferences(
  user: User,
  models: ModelPreferences,
  bearerToken?: string,
): Promise<ModelPreferences> {
  const nextMetadata = {
    ...(user.user_metadata || {}),
    openpikzels_models: models,
  };

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = adminDb();
    const res = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: nextMetadata,
    });
    if (res.error) {
      throw new AppError(503, "Could not save your models. Try again.");
    }
    return models;
  }

  const cfg = publicSupabaseConfig();
  if (cfg && bearerToken && !bearerToken.startsWith("opz1.")) {
    const r = await fetch(`${cfg.url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        apikey: cfg.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { openpikzels_models: models } }),
    });
    if (!r.ok) {
      throw new AppError(503, "Could not save your models. Try again.");
    }
    return models;
  }

  throw new AppError(503, "Could not save your models. Try again.");
}
