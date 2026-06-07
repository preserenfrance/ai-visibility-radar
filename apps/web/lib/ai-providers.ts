import type { AiEngineProvider } from "@ai-radar/shared";

export type SelectableAiProvider = Exclude<AiEngineProvider, "mock">;
export type SelectedEngineVariant = {
  provider: SelectableAiProvider;
  searchEnabled: boolean;
};

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
    .filter(isSelectableProvider);
  return selected.length > 0 ? Array.from(new Set(selected)) : ["openai"];
}

export function selectedEngineVariantsFromFormData(formData: FormData): SelectedEngineVariant[] {
  const variants = [
    ...selectedProviderValues(formData, "providers").map((provider) => ({
      provider,
      searchEnabled: false
    })),
    ...selectedProviderValues(formData, "providersWithSearch").map((provider) => ({
      provider,
      searchEnabled: true
    }))
  ];
  const seen = new Set<string>();
  const unique = variants.filter((variant) => {
    const key = `${variant.provider}:${variant.searchEnabled}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.length > 0 ? unique : [{ provider: "openai", searchEnabled: false }];
}

function selectedProviderValues(formData: FormData, fieldName: string): SelectableAiProvider[] {
  return formData.getAll(fieldName).map(String).filter(isSelectableProvider);
}

function isSelectableProvider(value: string): value is SelectableAiProvider {
  return AI_PROVIDER_OPTIONS.some((provider) => provider.id === value);
}
