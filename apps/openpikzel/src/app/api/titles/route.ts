import {
  authenticated,
  failure,
  requireAI,
  withUserProviders,
} from "@/lib/server";
import { ideaSchema } from "@/lib/validation";
import { suggestTitles } from "@/lib/providers";
import { NextResponse } from "next/server";
export const maxDuration = 60;
async function handle(request: Request) {
  try {
    await authenticated(request);
    requireAI("openai");
    const input = ideaSchema.parse(await request.json());
    return NextResponse.json({
      titles: await suggestTitles(input.prompt, input.audience),
    });
  } catch (e) {
    return failure(e);
  }
}

export const POST = (request: Request) =>
  withUserProviders(request, () => handle(request));
