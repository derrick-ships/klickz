import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { AppError } from "./validation";
import { publicSupabaseConfig } from "./config";
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
  const db = createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new AppError(401, "Your session expired. Please sign in again.");
  if (process.env.OWNER_GATE !== "false") {
    const access = await db.rpc("app_web_access");
    if (access.error || access.data !== true)
      throw new AppError(
        403,
        "This private studio is available to its owner only.",
      );
  }
  return { db, user: data.user };
}
export function requireAI(provider: "openai" | "jev") {
  if (process.env.AI_ENABLED !== "true")
    throw new AppError(
      403,
      "AI usage is disabled until provider usage is approved and enabled.",
    );
  if (
    !(provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.JEV_API_KEY)
  )
    throw new AppError(
      503,
      `${provider === "openai" ? "OpenAI" : "Jev"} is not configured.`,
    );
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
