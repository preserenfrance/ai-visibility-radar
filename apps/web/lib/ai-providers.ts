import type { AiEngineProvider } from "@ai-radar/shared";

export type SelectableAiProvider = Exclude<AiEngineProvider, "mock">;

export const AI_PROVIDER_OPTIONS: Array<{
  id: SelectableAiProvider;
  label: string;
  description: string;
}> = [
  {
    id: "openai",
    label: "ChatGPT",
    description: "OpenAI API"
  },
  {
    id: "google",
    label: "Gemini",
    description: "Google Gemini API"
  },
  {
    id: "anthropic",
    label: "Claude",
    description: "Anthropic API"
  }
];

export function selectedProvidersFromFormData(formData: FormData): SelectableAiProvider[] {
  const selected = formData
    .getAll("providers")
    .map(String)
    .filter((value): value is SelectableAiProvider =>
      AI_PROVIDER_OPTIONS.some((provider) => provider.id === value)
    );
  return selected.length > 0 ? Array.from(new Set(selected)) : ["openai"];
}
