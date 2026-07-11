import type { AiEngineProvider } from "@ai-radar/shared";
import { getConfig } from "@ai-radar/config";

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

export type LlmProviderApiCostReport = {
  provider: LlmCostProvider;
  label: string;
  status: "ok" | "missing_key" | "unavailable" | "error";
  sourceLabel: string;
  totalUsd: number | null;
  currency: string;
  message?: string;
  daily: Array<{ key: string; label: string; value: number }>;
  fetchedAt: string;
};

export async function fetchLlmProviderApiCosts(input: {
  monthStart: Date;
  nextMonthStart: Date;
  days: Array<{ key: string; label: string }>;
}): Promise<LlmProviderApiCostReport[]> {
  const config = getConfig();
  const [openai, anthropic] = await Promise.all([
    fetchOpenAiCosts({
      apiKey: config.OPENAI_ADMIN_API_KEY,
      monthStart: input.monthStart,
      nextMonthStart: input.nextMonthStart,
      days: input.days,
    }),
    fetchAnthropicCosts({
      apiKey: config.ANTHROPIC_ADMIN_API_KEY,
      monthStart: input.monthStart,
      nextMonthStart: input.nextMonthStart,
      days: input.days,
    }),
  ]);

  return [
    openai,
    unavailableReport(
      "google",
      input.days,
      "Gemini API za API-key projekte trenutno nima enostavnega billing/usage endpointa. Realno porabo preveri v AI Studio Dashboard > Usage ali prek Google Cloud Billing reporta.",
    ),
    anthropic,
  ];
}

async function fetchOpenAiCosts(input: {
  apiKey?: string;
  monthStart: Date;
  nextMonthStart: Date;
  days: Array<{ key: string; label: string }>;
}): Promise<LlmProviderApiCostReport> {
  if (!input.apiKey) {
    return missingKeyReport(
      "openai",
      input.days,
      "Nastavi OPENAI_ADMIN_API_KEY za realen OpenAI billing prikaz.",
    );
  }

  try {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set(
      "start_time",
      String(Math.floor(input.monthStart.getTime() / 1000)),
    );
    url.searchParams.set(
      "end_time",
      String(Math.floor(input.nextMonthStart.getTime() / 1000)),
    );
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");

    const data = await fetchPaginatedProviderReport(url, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
    });
    const daily = input.days.map((day) => ({ ...day, value: 0 }));

    for (const bucket of data) {
      const bucketDate = dateKeyFromProviderBucket(bucket);
      const day = daily.find((item) => item.key === bucketDate);
      const cost = providerResults(bucket).reduce(
        (sum, result) => sum + openAiResultUsd(result),
        0,
      );
      if (day) day.value += cost;
    }

    return {
      provider: "openai",
      label: LLM_COST_PROVIDER_LABELS.openai,
      status: "ok",
      sourceLabel: "OpenAI Costs API",
      totalUsd: daily.reduce((sum, day) => sum + day.value, 0),
      currency: "usd",
      daily,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return errorReport("openai", input.days, error);
  }
}

async function fetchAnthropicCosts(input: {
  apiKey?: string;
  monthStart: Date;
  nextMonthStart: Date;
  days: Array<{ key: string; label: string }>;
}): Promise<LlmProviderApiCostReport> {
  if (!input.apiKey) {
    return missingKeyReport(
      "anthropic",
      input.days,
      "Nastavi ANTHROPIC_ADMIN_API_KEY za realen Claude cost report.",
    );
  }

  try {
    const url = new URL(
      "https://api.anthropic.com/v1/organizations/cost_report",
    );
    url.searchParams.set("starting_at", input.monthStart.toISOString());
    url.searchParams.set("ending_at", input.nextMonthStart.toISOString());
    url.searchParams.append("group_by[]", "description");
    url.searchParams.set("limit", "31");

    const data = await fetchPaginatedProviderReport(url, {
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": input.apiKey,
      },
    });
    const daily = input.days.map((day) => ({ ...day, value: 0 }));

    for (const bucket of data) {
      const bucketDate = dateKeyFromProviderBucket(bucket);
      const day = daily.find((item) => item.key === bucketDate);
      const cost = providerResults(bucket).reduce(
        (sum, result) => sum + anthropicResultUsd(result),
        0,
      );
      if (day) day.value += cost;
    }

    return {
      provider: "anthropic",
      label: LLM_COST_PROVIDER_LABELS.anthropic,
      status: "ok",
      sourceLabel: "Anthropic Cost API",
      totalUsd: daily.reduce((sum, day) => sum + day.value, 0),
      currency: "usd",
      daily,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return errorReport("anthropic", input.days, error);
  }
}

async function fetchPaginatedProviderReport(
  initialUrl: URL,
  init: RequestInit,
) {
  const buckets: unknown[] = [];
  let page: string | undefined;

  for (let index = 0; index < 10; index += 1) {
    const url = new URL(initialUrl);
    if (page) url.searchParams.set("page", page);
    const response = await fetchWithTimeout(url.toString(), {
      ...init,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(providerApiError(response.status, data));
    }

    if (Array.isArray((data as { data?: unknown }).data)) {
      buckets.push(...((data as { data: unknown[] }).data ?? []));
    }

    const nextPage = (data as { next_page?: unknown }).next_page;
    if (
      !(data as { has_more?: unknown }).has_more ||
      typeof nextPage !== "string"
    ) {
      break;
    }
    page = nextPage;
  }

  return buckets;
}

function providerResults(bucket: unknown) {
  const value = bucket as { results?: unknown };
  return Array.isArray(value.results) ? value.results : [];
}

function openAiResultUsd(result: unknown) {
  const value = result as { amount?: { value?: unknown } };
  return Number(value.amount?.value) || 0;
}

function anthropicResultUsd(result: unknown) {
  const record = result as Record<string, unknown>;
  const usdField =
    numberField(record.cost_usd) ??
    numberField(record.amount_usd) ??
    numberField(record.total_usd);
  if (usdField !== null) return usdField;

  const centsField =
    numberField(record.cost_cents) ??
    numberField(record.amount_cents) ??
    numberField(record.total_cost) ??
    numberField(record.cost) ??
    numberField(record.amount);
  return centsField === null ? 0 : centsField / 100;
}

function dateKeyFromProviderBucket(bucket: unknown) {
  const value = bucket as {
    start_time?: unknown;
    starting_at?: unknown;
    start_at?: unknown;
  };
  if (typeof value.start_time === "number") {
    return dateKey(new Date(value.start_time * 1000));
  }
  if (typeof value.starting_at === "string") {
    return dateKey(new Date(value.starting_at));
  }
  if (typeof value.start_at === "string") {
    return dateKey(new Date(value.start_at));
  }
  return "";
}

function missingKeyReport(
  provider: LlmCostProvider,
  days: Array<{ key: string; label: string }>,
  message: string,
): LlmProviderApiCostReport {
  return {
    provider,
    label: LLM_COST_PROVIDER_LABELS[provider],
    status: "missing_key",
    sourceLabel: "Provider API",
    totalUsd: null,
    currency: "usd",
    message,
    daily: days.map((day) => ({ ...day, value: 0 })),
    fetchedAt: new Date().toISOString(),
  };
}

function unavailableReport(
  provider: LlmCostProvider,
  days: Array<{ key: string; label: string }>,
  message: string,
): LlmProviderApiCostReport {
  return {
    provider,
    label: LLM_COST_PROVIDER_LABELS[provider],
    status: "unavailable",
    sourceLabel: "No provider API endpoint",
    totalUsd: null,
    currency: "usd",
    message,
    daily: days.map((day) => ({ ...day, value: 0 })),
    fetchedAt: new Date().toISOString(),
  };
}

function errorReport(
  provider: LlmCostProvider,
  days: Array<{ key: string; label: string }>,
  error: unknown,
): LlmProviderApiCostReport {
  return {
    provider,
    label: LLM_COST_PROVIDER_LABELS[provider],
    status: "error",
    sourceLabel: "Provider API",
    totalUsd: null,
    currency: "usd",
    message: error instanceof Error ? error.message : "Provider API error.",
    daily: days.map((day) => ({ ...day, value: 0 })),
    fetchedAt: new Date().toISOString(),
  };
}

function numberField(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function dateKey(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function providerApiError(status: number, data: unknown) {
  const record = data as {
    error?: { message?: unknown };
    message?: unknown;
  };
  const message =
    typeof record.error?.message === "string"
      ? record.error.message
      : typeof record.message === "string"
        ? record.message
        : "unknown error";
  return `Provider API error ${status}: ${message}`;
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
