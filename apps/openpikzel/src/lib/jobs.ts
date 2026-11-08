import type { SupabaseClient } from "@supabase/supabase-js";
import { semanticDigest } from "./diagnostics";
import { AppError } from "./validation";
import type { JobState } from "./job-state";
export type { JobState } from "./job-state";
export async function reserveJob(
  db: SupabaseClient,
  userId: string,
  id: string,
  operation: "generate" | "analyze",
  payload: unknown,
  maxCalls: number,
) {
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 4)
    throw new AppError(400, "Invalid provider-request cap.");
  const payload_digest = semanticDigest(payload);
  const previous = await db
    .from("studio_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (previous.error) throw previous.error;
  if (previous.data) {
    if (
      ["queued", "running"].includes(previous.data.state) &&
      Date.parse(previous.data.deadline_at) <= Date.now()
    )
      await reconcileJobs(db);
    if (
      previous.data.operation !== operation ||
      previous.data.payload_digest !== payload_digest
    )
      throw new AppError(
        409,
        "This request ID was used with different inputs.",
      );
    if (previous.data.state === "succeeded" && previous.data.result)
      return { replay: previous.data.result as Record<string, unknown> };
    throw new AppError(
      409,
      "This request already exists. Check Jobs and your provider history before any new paid attempt.",
    );
  }
  const result = await db.from("studio_jobs").insert({
    id,
    user_id: userId,
    operation,
    payload_digest,
    state: "queued",
    max_provider_calls: maxCalls,
    deadline_at: new Date(
      Date.now() + (operation === "generate" ? 330000 : 210000),
    ).toISOString(),
  });
  if (result.error) {
    if (result.error.code === "23505")
      throw new AppError(409, "This request is already reserved. Check Jobs.");
    throw result.error;
  }
  return { replay: null };
}
export async function updateJob(
  db: SupabaseClient,
  userId: string,
  id: string,
  state: JobState,
  result?: unknown,
) {
  const update = await db
    .from("studio_jobs")
    .update({
      state,
      updated_at: new Date().toISOString(),
      ...(result ? { result } : {}),
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (update.error) throw update.error;
}
export function ambiguousProviderError(error: unknown) {
  const code =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : 0;
  return !(code >= 400 && code < 500 && code !== 408);
}

export async function reconcileJobs(db: SupabaseClient) {
  const r = await db.rpc("studio_reconcile_jobs");
  if (r.error) throw r.error;
}
