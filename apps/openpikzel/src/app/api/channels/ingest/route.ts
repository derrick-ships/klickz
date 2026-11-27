import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { userKeys } from "@/lib/provider-context";
import { channelIdentifier } from "@/lib/youtube";
import { channelIngestRequested, inngest } from "@/inngest/client";
import { AppError } from "@/lib/validation";

const bodySchema = z.object({
  channel: z.string().trim().min(1).max(300),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticated(request);
    const input = bodySchema.parse(await request.json());
    // Validate handle/URL format before dispatching
    channelIdentifier(input.channel);

    const keys = await userKeys(db, user.id);
    if (!keys.youtube) {
      throw new AppError(
        403,
        "Connect your YouTube Data API key in Keys before linking a channel.",
      );
    }
    if (!keys.google && !keys.openai && !keys.anthropic) {
      throw new AppError(
        403,
        "Connect Google Gemini (recommended — also transcribes YouTube videos natively), OpenAI, or Claude in Keys.",
      );
    }

    const runInsert = await db
      .from("channel_ingestion_runs")
      .insert({
        user_id: user.id,
        input_identifier: input.channel,
        status: "queued",
        progress_pct: 5,
        current_message: "Queued channel ingestion…",
      })
      .select("id")
      .single();
    if (runInsert.error || !runInsert.data) throw runInsert.error;
    const runId = runInsert.data.id as string;

    await inngest.send(
      channelIngestRequested.create({
        runId,
        userId: user.id,
        channelInput: input.channel,
      }),
    );

    return NextResponse.json(
      { runId, status: "queued" },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
