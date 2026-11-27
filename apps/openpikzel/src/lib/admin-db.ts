import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./validation";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase service-role client used exclusively by:
 * - Inngest durable background workers (decrypting user BYOK keys, persisting study phases)
 * - Unlisted `/reports/:slug` server-side read loader (strictly gated by `is_public = true` or owner match)
 * Never import this from client components.
 */
export function adminDb(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    throw new AppError(
      503,
      "Background worker storage is not configured (missing SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
