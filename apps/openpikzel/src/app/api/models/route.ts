import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { userKeys } from "@/lib/provider-context";
import { AppError } from "@/lib/validation";
import { modelPreferencesSchema, readModelPreferences, resolveAlias, textAliases } from "@/lib/model-preferences";
import { saveUserModelPreferences } from "@/lib/save-model-preferences";

// Settings → Models. Choices live in the user's auth metadata (no table needed).
// GET also reports what each "latest" choice resolves to with the user's own keys.
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    const keys = await userKeys(db, user.id);
    const resolved: Record<string, string | null> = {};
    await Promise.all(
      textAliases.map(async (alias) => {
        const key = keys[alias.provider];
        resolved[alias.id] = key ? (await resolveAlias(alias, key)).model : null;
      }),
    );
    return NextResponse.json({ models: readModelPreferences(user.user_metadata), resolved }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}

export async function PUT(request: Request) {
  try {
    const { user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write"))
      throw new AppError(403, "Allow write access to update model preferences.");
    const models = modelPreferencesSchema.parse(await request.json());
    const known = new Set(["auto", ...textAliases.map((a) => a.id)]);
    if (
      !known.has(models.reviewer) ||
      !known.has(models.mediator) ||
      !known.has(models.minds) ||
      !known.has(models.strategist)
    )
      throw new AppError(400, "Unknown model.");
    const mediator = textAliases.find((a) => a.id === models.mediator);
    if (mediator && mediator.provider === "anthropic")
      throw new AppError(400, "The prompt writer needs an OpenAI or Google model.");
    const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    await saveUserModelPreferences(user, models, token);
    return NextResponse.json({ models });
  } catch (e) {
    return failure(e);
  }
}
