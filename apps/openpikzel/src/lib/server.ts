import { createClient } from "@supabase/supabase-js";
import { modelPreferenceContext, readModelPreferences } from "./model-preferences";
import { NextResponse } from "next/server";
import { AppError } from "./validation";
import { publicSupabaseConfig } from "./config";
import { providerContext, providerKey, userKeys } from "./provider-context";
import { resolveAccess, type Scope } from "./oauth/core";
export async function authenticated(request: Request) {
  const config = publicSupabaseConfig();
  if (!config)
    throw new AppError(
      503,
      "Cloud storage is not configured. Use local drafts while setup is pending.",
    );
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AppError(401, "Sign in to use your cloud studio.");
  if (token.startsWith("opz1.")) return resolveAccess(token);
  const db = createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new AppError(401, "Your session expired. Please sign in again.");
  const claims = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  );
  if (claims.client_id)
    throw new AppError(
      403,
      "Connect through the OpenPikzels OAuth consent flow.",
    );
  const accessMode =
    process.env.ACCESS_MODE ||
    (process.env.OWNER_GATE === "false" ? "public" : "invite_only");
  if (accessMode !== "public") {
    const invite = await db.rpc("app_invite_access");
    const allowed =
      !invite.error && invite.data === true
        ? true
        : invite.error
          ? await db
              .rpc("app_web_access")
              .then((r) => !r.error && r.data === true)
          : false;
    if (!allowed)
      throw new AppError(
        403,
        "This workspace is currently invite-only. Ask the owner to add your email.",
      );
  }
  return { db, user: data.user, oauth: undefined };
}
export function requireAI(provider: "openai" | "jev" | "google" | "anthropic") {
  if (process.env.AI_ENABLED !== "true")
    throw new AppError(
      403,
      "AI usage is awaiting activation. Your account will use only your own connected keys.",
    );
  providerKey(provider);
}
export async function withUserProviders(
  request: Request,
  work: () => Promise<Response>,
  scope: Scope | Scope[] = "studio:ai",
) {
  try {
    const context = await authenticated(request);
    const required = Array.isArray(scope) ? scope : [scope];
    if (
      context.oauth &&
      required.some((s) => !context.oauth!.scope.includes(s))
    )
      throw new AppError(403, "Your agent lacks permission for this action.");
    const keys = await userKeys(context.db, context.user.id);
    const models = readModelPreferences(context.user.user_metadata);
    return await providerContext.run(keys, () => modelPreferenceContext.run(models, work));
  } catch (e) {
    return failure(e);
  }
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof Error && error.name === "ZodError")
    return NextResponse.json(
      { error: "Check the request fields and try again." },
      { status: 400 },
    );
  // Provider and database errors may contain request data: never relay or log them.
  return NextResponse.json(
    {
      error:
        "The operation could not finish. Your saved work is safe. Check provider setup or try again.",
    },
    { status: 502 },
  );
}
