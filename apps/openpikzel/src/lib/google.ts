import { imageModel } from "./image-models";
import { providerKey } from "./provider-context";
import { AppError } from "./validation";
import type { Settings } from "./types";
async function generate(
  model: string,
  parts: unknown[],
  generationConfig: Record<string, unknown>,
  timeoutMs = 240000,
  systemInstruction?: string,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": providerKey("google"),
      },
      body: JSON.stringify({
        ...(systemInstruction?{systemInstruction:{parts:[{text:systemInstruction}]}}:{}),
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok)
    throw new AppError(
      502,
      "Google could not complete this request. Check your key, model access and quota.",
    );
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts as
    | { text?: string; inlineData?: { mimeType: string; data: string } }[]
    | undefined;
}
export async function googleText(
  instructions: string,
  prompt: string,
  images: Buffer[] = [],
  json = false,
) {
  const parts = await generate(
    process.env.GOOGLE_TEXT_MODEL || "gemini-3.5-flash-lite",
    [
      {
        text:
          "<studio-context-data>\n" + prompt + "\n</studio-context-data>",
      },
      ...images.map((b) => ({
        inlineData: { mimeType: "image/jpeg", data: b.toString("base64") },
      })),
    ],
    {
      ...(json ? { responseMimeType: "application/json" } : {}),
      maxOutputTokens: 3000,
    },
    45000,
    instructions,
  );
  const text = parts
    ?.filter((p) => p.text)
    .map((p) => p.text)
    .join("");
  if (!text) throw new AppError(502, "Google returned no text.");
  return text;
}
export async function googleImage(
  prompt: string,
  refs: Buffer[],
  settings: Settings,
) {
  const selected=imageModel(settings.model);
  if(refs.length>selected.maxReferences)throw new AppError(400,"This image model supports at most "+selected.maxReferences+" reference images.");
  const model = selected.apiModel;
  const parts = await generate(
    model,
    [
      { text: prompt },
      ...refs.map((b) => ({
        inlineData: { mimeType: "image/png", data: b.toString("base64") },
      })),
    ],
    {
      responseModalities: ["TEXT", "IMAGE"],
      responseFormat: {
        image: {
          aspectRatio: settings.format === "short" ? "9:16" : "16:9",
          imageSize: "1K",
        },
      },
    },
  );
  const image = parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!image) throw new AppError(502, "Google returned no image.");
  return Buffer.from(image.data, "base64");
}
