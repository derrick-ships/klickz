import { z } from "zod";
import { fetchReference, youtubeTitle } from "@/lib/reference";
import { failure, authenticated } from "@/lib/server";
import { publicSupabaseConfig } from "@/lib/config";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    if (publicSupabaseConfig()) await authenticated(request);
    const { url } = z
      .object({ url: z.string().max(2000) })
      .parse(await request.json());
    const [image, title] = await Promise.all([fetchReference(url), youtubeTitle(url)]);
    const headers: Record<string, string> = { "Content-Type": "image/png", "Cache-Control": "no-store" };
    // Header values must be ASCII; the client decodes this.
    if (title) headers["X-Video-Title"] = encodeURIComponent(title);
    return new Response(new Uint8Array(image), { headers });
  } catch (e) {
    return failure(e);
  }
}
