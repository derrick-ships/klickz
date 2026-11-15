import OpenAI from "openai";
import { z } from "zod";
import { thumbnailRubric, scoringInstructions } from "./instructions";
import { pillars } from "./types";
import { providerKey, providerContext } from "./provider-context";
import { googleText } from "./google";
import { AppError } from "./validation";
import { anthropicVisionModel, type VisionProvider } from "./vision-provider";
import { currentModelPreferences, modelFor } from "./model-preferences";

// Same rubric and answer shape as Jev ({answers:{pillar:{score:0-3|null,confidence:0-1}}}),
// so everything after scoring works unchanged whichever scorer the user picked.
const answersSchema = z.object({
  answers: z.object(Object.fromEntries(pillars.map((p) => [p, z.object({ score: z.number().int().min(0).max(3).nullable(), confidence: z.number().min(0).max(1) })]))),
});

const instructions = (title: string) =>
  scoringInstructions +
  "\nScore each pillar on the 0-3 scale of its criteria (index of the best-matching criterion). Use null only when the pillar cannot be assessed" +
  (title ? "." : " (no title: judge idea and curiosity against the INTENDED PROMISE in videoBrief and the image itself; null only if there is no promise either).") +
  ' Return JSON only: {"answers":{"virality":{"score":0-3|null,"confidence":0-1},"clarity":…,"idea":…,"curiosity":…,"emotion":…}}.\nRUBRIC:\n' +
  JSON.stringify(thumbnailRubric);

export async function modelScores(provider: VisionProvider, image: Buffer, preview: Buffer, title: string, videoBrief: string, visualGuidance?: unknown) {
  const store = providerContext.getStore();
  const choice = currentModelPreferences().reviewer;
  const data = JSON.stringify({ title, videoBrief, visualGuidance, attachmentRoles: ["original", "actual small preview"] });
  let text: string;
  try {
    if (provider === "openai") {
      const model = await modelFor(choice, "openai", store?.openai, process.env.OPENAI_TEXT_MODEL || "gpt-5.5");
      const r = await new OpenAI({ apiKey: providerKey("openai"), maxRetries: 0, timeout: 60000 }).responses.create({
        model, instructions: instructions(title), text: { format: { type: "json_object" } }, max_output_tokens: 800,
        input: [{ role: "user", content: [{ type: "input_text", text: "Answer in JSON. Data:\n" + data }, ...[image, preview].map((b) => ({ type: "input_image" as const, image_url: "data:image/jpeg;base64," + b.toString("base64"), detail: "high" as const }))] }],
      });
      text = r.output_text;
    } else if (provider === "google") {
      const model = await modelFor(choice, "google", store?.google, process.env.GOOGLE_TEXT_MODEL || "gemini-3.5-flash-lite");
      text = await googleText(instructions(title), data, [image, preview], true, model);
    } else {
      const model = await modelFor(choice, "anthropic", store?.anthropic, anthropicVisionModel());
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": providerKey("anthropic"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2000, system: instructions(title), messages: [{ role: "user", content: [...[image, preview].map((b) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.toString("base64") } })), { type: "text", text: data }] }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new AppError(r.status, "The scoring model could not finish.");
      const payload = await r.json();
      text = (payload.content || []).find((b: { type?: string }) => b.type === "text")?.text || "";
    }
    return answersSchema.parse(JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "The scoring model didn't return a usable score. Try again or switch the scorer to Jev in Settings.");
  }
}
