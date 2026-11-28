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

function candidateProvidersForRole(role: LlmRole): {
  providers: VisionProvider[];
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
  const fallbackOrder: VisionProvider[] =
    role === "minds"
      ? ["google", "openai", "anthropic"]
      : ["openai", "google", "anthropic"];

  const ordered: VisionProvider[] = [];
  if (preferred && keys[preferred]) ordered.push(preferred);
  for (const p of fallbackOrder) {
    if (keys[p] && !ordered.includes(p)) ordered.push(p);
  }
  if (!ordered.length) {
    throw new AppError(
      403,
      "Connect at least one AI key (OpenAI, Google Gemini, or Claude) in Keys to run Pre-Flight Studies.",
    );
  }
  return { providers: ordered, choice };
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
 * with schema self-repair and automatic cross-provider fallback across connected keys.
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
  const { providers, choice } = candidateProvidersForRole(params.role);
  const store = providerContext.getStore() || {};
  const images = params.images ?? [];
  const maxTokens = Math.max(params.maxTokens ?? 4096, 6144);
  const timeoutMs = params.timeoutMs ?? 90_000;

  let lastError: unknown;

  // Build attempt sequence: primary gets 2 tries (1 initial + 1 schema/JSON repair),
  // then each fallback provider gets 1 clean attempt (OpenAI/Gemini native JSON mode).
  const plan: { provider: VisionProvider; repair: boolean }[] = [
    { provider: providers[0], repair: false },
    { provider: providers[0], repair: true },
    ...providers.slice(1).map((p) => ({ provider: p, repair: false })),
  ];

  let feedback = "";

  for (const step of plan) {
    const provider = step.provider;
    const promptWithRepair =
      step.repair && feedback
        ? `${params.userPrompt}\n\nPREVIOUS OUTPUT FAILED VALIDATION. Return ONLY a single valid JSON object (escape any quotes inside strings or use single quotes) fixing:\n${feedback}`
        : params.userPrompt;

    let rawText = "";
    let model = "";

    try {
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
          params.system +
            "\nReturn ONLY a single valid JSON object with no markdown fences. Never put unescaped double quotes inside string values.",
          promptWithRepair,
          images,
          true,
          model,
          { maxOutputTokens: Math.max(maxTokens, 8192), timeoutMs },
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
            max_tokens: Math.max(maxTokens, 8192),
            temperature: 0.2,
            system:
              params.system +
              "\nReturn ONLY a single valid RFC 8259 JSON object. No markdown fences or prose. Inside string values, use single quotes instead of double quotes (or properly escape \\\").",
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
              {
                role: "assistant",
                content: "{",
              },
            ],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          throw new AppError(
            502,
            `Claude returned HTTP ${response.status} during ${params.role}.`,
          );
        }
        const payload = await response.json();
        const body = (payload.content || [])
          .filter((b: { type?: string }) => b.type === "text")
          .map((b: { text?: string }) => b.text || "")
          .join("");
        rawText = body.trimStart().startsWith("{") ? body : "{" + body;
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
            params.system +
            "\nReturn ONLY a single valid JSON object matching the requested shape.",
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
          max_output_tokens: Math.max(maxTokens, 8192),
        });
        rawText = response.output_text || "";
      }

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
        err instanceof SyntaxError
          ? `Invalid JSON syntax (${err.message}). Return strictly valid JSON and use single quotes inside text strings.`
          : err instanceof Error
            ? err.message
            : "Response failed.";
      lastError = err;
    }
  }

  throw new AppError(
    502,
    `AI response for ${params.role} could not be parsed into the required structure. (${lastError instanceof Error ? lastError.message.slice(0, 140) : "invalid JSON"})`,
  );
}
