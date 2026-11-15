import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { userKeys } from "@/lib/provider-context";
import { AppError } from "@/lib/validation";
import { modelPreferencesSchema, readModelPreferences, resolveAlias, textAliases } from "@/lib/model-preferences";

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
    const { db, user, oauth } = await authenticated(request);
    if (oauth) throw new AppError(403, "Change models in OpenPikzels Settings.");
    sameOrigin(request);
    const models = modelPreferencesSchema.parse(await request.json());
    const known = new Set(["auto", ...textAliases.map((a) => a.id)]);
    if (!known.has(models.reviewer) || !known.has(models.mediator)) throw new AppError(400, "Unknown model.");
    const mediator = textAliases.find((a) => a.id === models.mediator);
    if (mediator && mediator.provider === "anthropic") throw new AppError(400, "The prompt writer needs an OpenAI or Google model.");
    const saved = await db.auth.updateUser({ data: { openpikzels_models: models } });
    if (saved.error) throw new AppError(503, "Could not save your models. Try again.");
    return NextResponse.json({ models });
  } catch (e) {
    return failure(e);
  }
}
