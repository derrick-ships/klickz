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
    | {
        text?: string;
        thought?: boolean;
        inlineData?: { mimeType: string; data: string };
      }[]
    | undefined;
}
export async function googleText(
  instructions: string,
  prompt: string,
  images: Buffer[] = [],
  json = false,
  model = process.env.GOOGLE_TEXT_MODEL || "gemini-3.5-flash-lite",
  options: {maxOutputTokens?:number;timeoutMs?:number} = {},
) {
  const parts = await generate(
    model,
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
      maxOutputTokens: json
        ? Math.max(options.maxOutputTokens ?? 4096, 8192)
        : (options.maxOutputTokens ?? 3000),
    },
    options.timeoutMs ?? 60000,
    instructions,
  );
  const nonThought = parts?.filter((p) => p.text && !p.thought) || [];
  const source = nonThought.length ? nonThought : parts?.filter((p) => p.text) || [];
  const text = source.map((p) => p.text).join("");
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

/**
 * Native Google Gemini YouTube video transcription & hook extraction via public fileUri.
 * Works directly on public YouTube URLs even when captions are turned off.
 */
export async function googleYoutubeTranscript(
  videoUrl: string,
  model = process.env.GOOGLE_TEXT_MODEL || "gemini-3.5-flash-lite",
): Promise<{ transcript: string; language: string }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": providerKey("google"),
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Extract an accurate spoken transcript excerpt (prioritizing the opening 90 seconds and key thematic beats, up to 3500 characters) in the video's original spoken language, plus its 2-letter ISO language code. Return JSON only: {\"language\":\"en\",\"transcript\":\"...\"}.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: videoUrl,
                  mimeType: "video/*",
                },
              },
              {
                text: "Transcribe the opening hook and main spoken segments in the original language. Return JSON only.",
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(75_000),
    },
  );
  if (!response.ok) {
    throw new AppError(
      502,
      `Google Gemini could not transcribe YouTube video (HTTP ${response.status}).`,
    );
  }
  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .filter((p: { text?: string }) => p.text)
    .map((p: { text: string }) => p.text)
    .join("");
  if (!text) throw new AppError(502, "Google Gemini returned empty transcript.");
  try {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    return {
      transcript: String(parsed.transcript || "").slice(0, 4000),
      language: String(parsed.language || "").split("-")[0].toLowerCase() || "en",
    };
  } catch {
    return { transcript: text.slice(0, 4000), language: "en" };
  }
}
