import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { AppError } from "@/lib/validation";

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  notes: z.string().max(800).optional(),
  tone_of_voice: z.string().max(1200).optional(),
  visual_style_rules: z.string().max(1200).optional(),
  default_style_id: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    const res = await db
      .from("studio_personas")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (res.error) throw res.error;

    const allPaths = [
      ...new Set(
        (res.data || []).flatMap((p) => (Array.isArray(p.refs) ? p.refs : [])),
      ),
    ];
    let signedMap: Record<string, string> = {};
    if (allPaths.length) {
      const signed = await db.storage
        .from("studio-assets")
        .createSignedUrls(allPaths, 3600);
      if (!signed.error && signed.data) {
        signedMap = Object.fromEntries(
          signed.data
            .filter((s) => s.path && s.signedUrl)
            .map((s) => [s.path!, s.signedUrl!]),
        );
      }
    }

    return NextResponse.json(
      { personas: res.data || [], imageUrls: signedMap },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write")) {
      throw new AppError(403, "Allow write access to update a persona.");
    }
    const input = updateSchema.parse(await request.json());
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.tone_of_voice !== undefined)
      patch.tone_of_voice = input.tone_of_voice;
    if (input.visual_style_rules !== undefined)
      patch.visual_style_rules = input.visual_style_rules;
    if (input.default_style_id !== undefined)
      patch.default_style_id = input.default_style_id;

    const res = await db
      .from("studio_personas")
      .update(patch)
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (res.error || !res.data) throw new AppError(404, "Persona not found.");
    return NextResponse.json({ persona: res.data });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write")) {
      throw new AppError(403, "Allow write access to delete a persona.");
    }
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const res = await db
      .from("studio_personas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (res.error) throw res.error;
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
