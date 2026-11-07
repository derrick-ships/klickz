import { authenticated, failure, requireAI } from "@/lib/server";
import { ideaSchema } from "@/lib/validation";
import { suggestTitles } from "@/lib/providers";
import { NextResponse } from "next/server";
export const maxDuration = 60;
export async function POST(request: Request) {
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
