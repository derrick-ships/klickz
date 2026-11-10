import { requireScope } from "./oauth/core";
import { AppError } from "./validation";

type MemoryAuth = {
  db: any;
  user: { id: string };
  oauth?: { scope: readonly string[] };
};

const secretPattern =
  /\bsk-[A-Za-z0-9_-]{16,}|\bsb_secret_[A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b[0-9a-fA-F]{32,}\b|\b[A-Z][A-Z0-9_]{2,}=\S+/;

export function looksLikeSecret(value: string) {
  return secretPattern.test(value);
}

function requireSafeText(value: string) {
  if (looksLikeSecret(value))
    throw new AppError(400, "This looks like a secret and was not stored.");
}

export async function rememberFact(
  context: MemoryAuth,
  input: { fact: string; tags?: string[]; agent?: string; source?: string },
) {
  requireScope(context.oauth, "studio:agent");
  const fact = String(input.fact || "").trim();
  if (!fact || fact.length > 1000)
    throw new AppError(400, "Enter a short fact to remember.");
  requireSafeText(fact);
  for (const tag of input.tags || []) requireSafeText(String(tag));
  if (input.source) requireSafeText(String(input.source));
  const result = await context.db
    .from("studio_agent_memory")
    .insert({
      user_id: context.user.id,
      agent: input.agent || "default",
      fact,
      tags: input.tags || [],
      source: input.source || null,
    })
    .select("id,fact,tags,created_at")
    .single();
  if (result.error) {
    if (/Memory limit reached/i.test(String(result.error.message || result.error)))
      throw new AppError(400, "memory is full, forget something first");
    throw new AppError(503, "The fact could not be saved.");
  }
  return result.data;
}

export async function recallFacts(
  context: MemoryAuth,
  input: { query?: string } = {},
) {
  requireScope(context.oauth, "studio:agent");
  const query = input.query?.trim();
  if (query) requireSafeText(query);
  let request = context.db
    .from("studio_agent_memory")
    .select("id,fact,tags,created_at")
    .eq("user_id", context.user.id);
  if (query) request = request.ilike("fact", "%" + query + "%");
  const result = await request
    .order("created_at", { ascending: false })
    .limit(20);
  if (result.error) throw new AppError(503, "Facts could not be read.");
  return { facts: result.data || [] };
}

export async function forgetFact(context: MemoryAuth, input: { id: string }) {
  requireScope(context.oauth, "studio:agent");
  if (!input.id) throw new AppError(400, "Choose a remembered fact to forget.");
  const result = await context.db
    .from("studio_agent_memory")
    .delete()
    .eq("id", input.id)
    .eq("user_id", context.user.id)
    .select("id");
  if (result.error) throw new AppError(503, "The fact could not be removed.");
  return { forgotten: (result.data || []).length > 0 };
}
