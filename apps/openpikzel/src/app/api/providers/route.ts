import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { seal, sameOrigin } from "@/lib/crypto";
import { AppError } from "@/lib/validation";
import { limitedJson } from "@/lib/oauth/http";
export async function GET(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    if (oauth) throw new AppError(403, "Manage connections in the app.");
    const result = await db
      .from("studio_provider_keys")
      .select("provider,suffix,updated_at")
      .eq("user_id", user.id);
    if (result.error) throw result.error;
    return NextResponse.json(
      { connections: result.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user, oauth } = await authenticated(request);
    if (oauth) throw new AppError(403, "Manage connections in the app.");
    const input = z
      .object({
        provider: z.enum(["openai", "jev", "google", "youtube"]),
        key: z.string().trim().max(12000).default(""),
      })
      .parse(await limitedJson(request, 16000));
    if (!input.key) {
      const existing = await db.from("studio_provider_keys").select("provider").eq("user_id", user.id).eq("provider", input.provider).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) throw new AppError(400, "Paste a key to create this connection.");
      return NextResponse.json({ saved: false, kept: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (input.key.length < 12 || /[\r\n]/.test(input.key)) throw new AppError(400, "Paste one complete API key without line breaks.");
    const result = await db.from("studio_provider_keys").upsert({
      user_id: user.id,
      provider: input.provider,
      ciphertext: seal(
        { key: input.key },
        `provider:${user.id}:${input.provider}`,
      ),
      suffix: input.key.slice(-4),
      updated_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
    return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { db, user, oauth } = await authenticated(request);
    if (oauth) throw new AppError(403, "Manage connections in the app.");
    const { provider } = z
      .object({ provider: z.enum(["openai", "jev", "google", "youtube"]) })
      .parse(await request.json());
    const result = await db
      .from("studio_provider_keys")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (result.error) throw result.error;
    return NextResponse.json({ removed: true });
  } catch (e) {
    return failure(e);
  }
}
