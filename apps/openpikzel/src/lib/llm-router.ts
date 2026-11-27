import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { googleText } from "./google";
import {
  currentModelPreferences,
  modelFor,
  providerOfChoice,
} from "./model-preferences";
import { providerContext, providerKey } from "./provider-context";
import { AppError } from "./validation";
import { anthropicVisionModel, type VisionProvider } from "./vision-provider";

export type LlmRole = "minds" | "strategist" | "ingestion";

function pickProviderForRole(role: LlmRole): {
  provider: VisionProvider;
  choice: string;
} {
  const keys = providerContext.getStore() || {};
  const prefs = currentModelPreferences();
  const choice =
    role === "minds"
      ? prefs.minds || "gemini-flash-latest"
      : role === "strategist"
        ? prefs.strategist || "sonnet-latest"
        : prefs.strategist || "gemini-flash-latest";

  const preferred = providerOfChoice(choice);
  if (preferred && keys[preferred]) {
    return { provider: preferred, choice };
  }
  const order: VisionProvider[] =
    role === "minds"
      ? ["google", "openai", "anthropic"]
      : ["anthropic", "openai", "google"];
  for (const p of order) {
    if (keys[p]) return { provider: p, choice };
  }
  throw new AppError(
    403,
    "Connect at least one AI key (OpenAI, Google Gemini, or Claude) in Keys to run Pre-Flight Studies.",
  );
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

/**
 * Unified BYOK structured JSON caller supporting OpenAI, Anthropic, and Google Gemini
 * (with optional multimodal JPEG buffers and automatic 2-attempt schema self-repair).
 */
export async function callStructuredJson<T>(params: {
  role: LlmRole;
  system: string;
  userPrompt: string;
  images?: Buffer[];
  schema: z.ZodType<T>;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ data: T; provider: VisionProvider; model: string }> {
  const { provider, choice } = pickProviderForRole(params.role);
  const store = providerContext.getStore() || {};
  const images = params.images ?? [];
  const maxTokens = params.maxTokens ?? 4096;
  const timeoutMs = params.timeoutMs ?? 90_000;

  let feedback = "";
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const promptWithRepair = feedback
      ? `${params.userPrompt}\n\nPREVIOUS OUTPUT FAILED VALIDATION. Return ONLY valid JSON fixing:\n${feedback}`
      : params.userPrompt;

    let rawText = "";
    let model = "";

    if (provider === "google") {
      model = await modelFor(
        choice,
        "google",
        store.google,
        params.role === "minds"
          ? process.env.GOOGLE_TEXT_MODEL || "gemini-3.5-flash-lite"
          : "gemini-3.5-flash",
      );
      rawText = await googleText(
        params.system + "\nReturn ONLY valid JSON with no markdown fences.",
        promptWithRepair,
        images,
        true,
        model,
        { maxOutputTokens: maxTokens, timeoutMs },
      );
    } else if (provider === "anthropic") {
      model = await modelFor(
        choice,
        "anthropic",
        store.anthropic,
        anthropicVisionModel(),
      );
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": providerKey("anthropic"),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system:
            params.system +
            "\nReturn ONLY a single valid JSON object. No markdown fences or commentary.",
          messages: [
            {
              role: "user",
              content: [
                ...images.map((buf) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/jpeg" as const,
                    data: buf.toString("base64"),
                  },
                })),
                { type: "text" as const, text: promptWithRepair },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new AppError(
          502,
          `Claude returned HTTP ${response.status} during ${params.role}. Check your Anthropic key and balance.`,
        );
      }
      const payload = await response.json();
      rawText = (payload.content || [])
        .filter((b: { type?: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text || "")
        .join("");
    } else {
      model = await modelFor(
        choice,
        "openai",
        store.openai,
        process.env.OPENAI_TEXT_MODEL || "gpt-5.5",
      );
      const api = new OpenAI({
        apiKey: providerKey("openai"),
        maxRetries: 0,
        timeout: timeoutMs,
      });
      const response = await api.responses.create({
        model,
        store: false,
        instructions:
          params.system + "\nReturn ONLY valid JSON matching the requested shape.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Answer in JSON.\n" + promptWithRepair,
              },
              ...images.map((buf) => ({
                type: "input_image" as const,
                image_url: `data:image/jpeg;base64,${buf.toString("base64")}`,
                detail: "auto" as const,
              })),
            ],
          },
        ],
        text: { format: { type: "json_object" } },
        max_output_tokens: maxTokens,
      });
      rawText = response.output_text || "";
    }

    try {
      const parsedJson = JSON.parse(stripJsonFences(rawText));
      const validated = params.schema.safeParse(parsedJson);
      if (validated.success) {
        return { data: validated.data, provider, model };
      }
      feedback = validated.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; ");
      lastError = validated.error;
    } catch (err) {
      feedback =
        "Response was not valid JSON. Return a single JSON object with no surrounding prose.";
      lastError = err;
    }
  }

  throw new AppError(
    502,
    `AI response for ${params.role} could not be parsed into the required structure. (${lastError instanceof Error ? lastError.message.slice(0, 140) : "invalid JSON"})`,
  );
}
