import { z } from "zod";
import { NextResponse } from "next/server";
import { authenticated, failure, requireAI, withUserProviders } from "@/lib/server";
import { mediate } from "@/lib/mediator";
import { hasProvider } from "@/lib/provider-context";
import { AppError } from "@/lib/validation";

// "Plan it": turns a rough idea ("receta arepas") into an editable brief with the same
// mediator used for images, without generating or paying for an image.
const input = z.object({
  prompt: z.string().trim().min(3).max(2400),
  title: z.string().trim().max(100).default(""),
  format: z.enum(["long", "short"]).default("long"),
  style: z.string().max(120).default("Auto"),
});

async function handle(request: Request) {
  await authenticated(request);
  const body = input.parse(await request.json());
  if (!hasProvider("openai") && !hasProvider("google")) throw new AppError(403, "Connect an OpenAI or Google key to plan a thumbnail.");
  requireAI(hasProvider("openai") ? "openai" : "google");
  const result = await mediate({ rawPrompt: body.prompt, title: body.title, format: body.format, style: body.style, notes: [], variation: 1, hasPersona: false, isEdit: false });
  const e = result.enriched;
  // The brief the user edits: what the image shows, the lever, the words on it.
  const brief = [e.concept, e.imageText.length ? `Text: "${e.imageText.join(" / ")}"` : "", e.lever !== "NONE" ? `Lever: ${e.lever}` : ""].filter(Boolean).join("\n");
  return NextResponse.json({ brief, concept: e.concept, lever: e.lever, imageText: e.imageText, panels: e.panels, decisions: e.decisions, model: result.model });
}
export const POST = (request: Request) => withUserProviders(request, () => handle(request).catch(failure), ["studio:ai"]);
