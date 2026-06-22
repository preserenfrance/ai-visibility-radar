import type { AiEngineProvider } from "@ai-radar/shared";

export type LlmCostProvider = Exclude<AiEngineProvider, "mock">;

export const LLM_COST_PROVIDERS: LlmCostProvider[] = [
  "openai",
  "google",
  "anthropic",
];

export const LLM_COST_PROVIDER_LABELS: Record<LlmCostProvider, string> = {
  openai: "ChatGPT",
  google: "Gemini",
  anthropic: "Claude",
};

type Rate = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const FALLBACK_RATES: Record<LlmCostProvider, Rate> = {
  openai: { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
  google: { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 },
  anthropic: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
};

export function estimatedAiCostUsd(input: {
  provider: LlmCostProvider;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
}) {
  const rate = rateForModel(input.provider, input.model);
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;

  return (
    (inputTokens * rate.inputUsdPerMillion +
      outputTokens * rate.outputUsdPerMillion) /
    1_000_000
  );
}

export function providerRateLabel(provider: LlmCostProvider, model?: string) {
  const rate = rateForModel(provider, model ?? "");
  return `$${formatMoney(rate.inputUsdPerMillion)}/1M input, $${formatMoney(rate.outputUsdPerMillion)}/1M output`;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("sl-SI", {
    minimumFractionDigits: value >= 10 ? 2 : 4,
    maximumFractionDigits: value >= 10 ? 2 : 4,
  }).format(value);
}

function rateForModel(provider: LlmCostProvider, model: string): Rate {
  const envRate = envRateForProvider(provider);
  if (envRate) return envRate;

  const lower = model.toLowerCase();

  if (provider === "openai") {
    if (lower.includes("gpt-4o") && !lower.includes("mini")) {
      return { inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 };
    }
    return FALLBACK_RATES.openai;
  }

  if (provider === "google") {
    if (lower.includes("pro"))
      return { inputUsdPerMillion: 1.25, outputUsdPerMillion: 5 };
    return FALLBACK_RATES.google;
  }

  if (provider === "anthropic") {
    if (lower.includes("haiku"))
      return { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 };
    if (lower.includes("opus"))
      return { inputUsdPerMillion: 15, outputUsdPerMillion: 75 };
    return FALLBACK_RATES.anthropic;
  }

  return FALLBACK_RATES[provider];
}

function envRateForProvider(provider: LlmCostProvider): Rate | null {
  const prefix =
    provider === "openai"
      ? "OPENAI"
      : provider === "google"
        ? "GEMINI"
        : "CLAUDE";
  const input = Number(process.env[`LLM_${prefix}_INPUT_USD_PER_1M`]);
  const output = Number(process.env[`LLM_${prefix}_OUTPUT_USD_PER_1M`]);

  if (
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    input < 0 ||
    output < 0
  )
    return null;
  return { inputUsdPerMillion: input, outputUsdPerMillion: output };
}
