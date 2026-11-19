// Browser-safe catalog of model choices (no server imports). model-preferences.ts reuses it.
export type ChoiceProvider = "anthropic" | "openai" | "google";
export const textChoices: { id: string; label: string; provider: ChoiceProvider }[] = [
  { id: "opus-latest", label: "Claude Opus", provider: "anthropic" },
  { id: "sonnet-latest", label: "Claude Sonnet", provider: "anthropic" },
  { id: "haiku-latest", label: "Claude Haiku", provider: "anthropic" },
  { id: "gpt-6.2-sol", label: "GPT Sol 6.2", provider: "openai" },
  { id: "gpt-sol-latest", label: "GPT Sol", provider: "openai" },
  { id: "gpt-terra-latest", label: "GPT Terra", provider: "openai" },
  { id: "gpt-luna-latest", label: "GPT Luna", provider: "openai" },
  { id: "gemini-pro-latest", label: "Gemini Pro", provider: "google" },
  { id: "gemini-flash-latest", label: "Gemini Flash", provider: "google" },
];
export const providerOfChoice = (choice: string): ChoiceProvider | null => textChoices.find((c) => c.id === choice)?.provider ?? null;
