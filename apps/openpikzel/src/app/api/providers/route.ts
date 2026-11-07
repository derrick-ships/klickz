import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { seal, sameOrigin } from "@/lib/crypto";
import { AppError } from "@/lib/validation";
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
        provider: z.enum(["openai", "jev", "google"]),
        key: z.string().trim().min(12).max(12000),
      })
      .parse(await request.json());
    const result = await db
      .from("studio_provider_keys")
      .upsert({
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
    return NextResponse.json({ saved: true });
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
      .object({ provider: z.enum(["openai", "jev", "google"]) })
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
