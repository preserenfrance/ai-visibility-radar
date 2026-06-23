import { getConfig } from "@ai-radar/config";
import { prisma } from "@ai-radar/db";
import type { AiEngineProvider } from "@ai-radar/shared";

const AI_MODEL_SETTINGS_KEY = "ai_model_settings";

export type AiModelProvider = Extract<
  AiEngineProvider,
  "openai" | "google" | "anthropic"
>;

export const AI_MODEL_MODES = ["classic", "search"] as const;
export type AiModelMode = (typeof AI_MODEL_MODES)[number];

export type AiProviderModelSettings = Record<AiModelProvider, string>;
export type AiModelSettings = Record<AiModelMode, AiProviderModelSettings>;
export type AiModelSettingsInput = Partial<
  Record<AiModelMode, Partial<AiProviderModelSettings>>
>;

export type AiModelProviderOption = {
  mode: AiModelMode;
  provider: AiModelProvider;
  label: string;
  models: string[];
  currentModel: string;
  fieldName: string;
  error?: string;
};

export type AiModelOptionGroup = {
  mode: AiModelMode;
  label: string;
  description: string;
  options: AiModelProviderOption[];
};

export const AI_MODEL_PROVIDER_LABELS: Record<AiModelProvider, string> = {
  openai: "OpenAI / ChatGPT",
  google: "Google / Gemini",
  anthropic: "Anthropic / Claude",
};

export const AI_MODEL_MODE_LABELS: Record<AiModelMode, string> = {
  classic: "Klasični modeli",
  search: "Search modeli",
};

export const AI_MODEL_MODE_DESCRIPTIONS: Record<AiModelMode, string> = {
  classic:
    "Uporabljajo se za navadne preglede brez spletnega iskanja in za klasične modele v aplikaciji.",
  search:
    "Uporabljajo se za preglede z vključenim searchom, kjer modeli lahko vračajo vire in citate.",
};

const FALLBACK_PROVIDER_MODELS: AiProviderModelSettings = {
  openai: "gpt-4o-mini",
  google: "gemini-1.5-flash",
  anthropic: "claude-3-5-sonnet-latest",
};

export async function aiModelSettings(): Promise<AiModelSettings> {
  const defaults = defaultModelSettings();
  const saved = await prisma.systemPrompt
    .findUnique({ where: { key: AI_MODEL_SETTINGS_KEY } })
    .catch(() => null);
  if (!saved?.content) return defaults;

  try {
    return normalizeModelSettings(JSON.parse(saved.content), defaults);
  } catch {
    return defaults;
  }
}

export async function saveAiModelSettings(
  settings: AiModelSettingsInput,
  updatedByEmail?: string,
) {
  const current = await aiModelSettings();
  const next = normalizeModelSettings({ ...current, ...settings }, current);
  const content = JSON.stringify(next, null, 2);

  return prisma.systemPrompt.upsert({
    where: { key: AI_MODEL_SETTINGS_KEY },
    update: {
      title: "Globalni AI modeli",
      description:
        "Globalna izbira modelov, ki jih aplikacija uporablja pri novih scanih.",
      content,
      defaultContent: JSON.stringify(current, null, 2),
      updatedByEmail,
    },
    create: {
      key: AI_MODEL_SETTINGS_KEY,
      title: "Globalni AI modeli",
      description:
        "Globalna izbira modelov, ki jih aplikacija uporablja pri novih scanih.",
      content,
      defaultContent: JSON.stringify(current, null, 2),
      updatedByEmail,
    },
  });
}

export function aiModelForProvider(
  settings: AiModelSettings,
  provider: AiModelProvider,
  searchEnabled = false,
) {
  return settings[searchEnabled ? "search" : "classic"][provider];
}

export async function availableAiModels(): Promise<AiModelOptionGroup[]> {
  const [settings, openai, google, anthropic] = await Promise.all([
    aiModelSettings(),
    fetchOpenAiModels(),
    fetchGeminiModels(),
    fetchClaudeModels(),
  ]);

  const providerResults = { openai, google, anthropic };
  const providers: AiModelProvider[] = ["openai", "google", "anthropic"];

  return AI_MODEL_MODES.map((mode) => ({
    mode,
    label: AI_MODEL_MODE_LABELS[mode],
    description: AI_MODEL_MODE_DESCRIPTIONS[mode],
    options: providers.map((provider) =>
      withCurrentModel(
        mode,
        provider,
        settings[mode][provider],
        providerResults[provider],
      ),
    ),
  }));
}

function normalizeModelSettings(
  value: unknown,
  defaults: AiModelSettings,
): AiModelSettings {
  const candidate = isRecord(value) ? value : {};
  const legacy = normalizeProviderModelSettings(candidate, defaults.classic);
  const classicSource = isRecord(candidate.classic)
    ? candidate.classic
    : legacy;
  const searchSource = isRecord(candidate.search) ? candidate.search : legacy;

  return {
    classic: normalizeProviderModelSettings(classicSource, defaults.classic),
    search: normalizeProviderModelSettings(searchSource, defaults.search),
  };
}

function normalizeProviderModelSettings(
  value: unknown,
  defaults: AiProviderModelSettings,
): AiProviderModelSettings {
  const candidate = isRecord(value) ? value : {};
  return {
    openai:
      typeof candidate.openai === "string" && candidate.openai.trim()
        ? candidate.openai.trim()
        : defaults.openai,
    google:
      typeof candidate.google === "string" && candidate.google.trim()
        ? candidate.google.trim()
        : defaults.google,
    anthropic:
      typeof candidate.anthropic === "string" && candidate.anthropic.trim()
        ? candidate.anthropic.trim()
        : defaults.anthropic,
  };
}

function defaultModelSettings(): AiModelSettings {
  const config = getConfig();
  const providerDefaults: AiProviderModelSettings = {
    openai: config.OPENAI_MODEL ?? FALLBACK_PROVIDER_MODELS.openai,
    google: config.GEMINI_MODEL ?? FALLBACK_PROVIDER_MODELS.google,
    anthropic: config.CLAUDE_MODEL ?? FALLBACK_PROVIDER_MODELS.anthropic,
  };

  return {
    classic: { ...providerDefaults },
    search: { ...providerDefaults },
  };
}

function withCurrentModel(
  mode: AiModelMode,
  provider: AiModelProvider,
  currentModel: string,
  result: { models: string[]; error?: string },
): AiModelProviderOption {
  const models = uniqueSorted([currentModel, ...result.models].filter(Boolean));
  return {
    mode,
    provider,
    label: AI_MODEL_PROVIDER_LABELS[provider],
    currentModel,
    fieldName: `${mode}_${provider}`,
    models,
    error: result.error,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function fetchOpenAiModels() {
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    return { models: [], error: "OPENAI_API_KEY ni nastavljen." };
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/models",
      {
        headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
        cache: "no-store",
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        models: [],
        error: `OpenAI API napaka ${response.status}.`,
      };
    }
    const models = Array.isArray(data.data)
      ? data.data
          .map((item: { id?: unknown }) =>
            typeof item.id === "string" ? item.id : "",
          )
          .filter(isLikelyOpenAiChatModel)
      : [];
    return { models: uniqueSorted(models) };
  } catch (error) {
    return { models: [], error: errorMessage(error) };
  }
}

async function fetchGeminiModels() {
  const config = getConfig();
  if (!config.GEMINI_API_KEY) {
    return { models: [], error: "GEMINI_API_KEY ni nastavljen." };
  }

  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        models: [],
        error: `Gemini API napaka ${response.status}.`,
      };
    }
    const models = Array.isArray(data.models)
      ? data.models
          .filter((item: { supportedGenerationMethods?: unknown }) =>
            Array.isArray(item.supportedGenerationMethods)
              ? item.supportedGenerationMethods.includes("generateContent")
              : true,
          )
          .map((item: { name?: unknown }) =>
            typeof item.name === "string"
              ? item.name.replace(/^models\//, "")
              : "",
          )
          .filter(Boolean)
      : [];
    return { models: uniqueSorted(models) };
  } catch (error) {
    return { models: [], error: errorMessage(error) };
  }
}

async function fetchClaudeModels() {
  const config = getConfig();
  if (!config.ANTHROPIC_API_KEY) {
    return { models: [], error: "ANTHROPIC_API_KEY ni nastavljen." };
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.anthropic.com/v1/models",
      {
        headers: {
          "x-api-key": config.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        cache: "no-store",
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        models: [],
        error: `Anthropic API napaka ${response.status}.`,
      };
    }
    const models = Array.isArray(data.data)
      ? data.data
          .map((item: { id?: unknown }) =>
            typeof item.id === "string" ? item.id : "",
          )
          .filter(Boolean)
      : [];
    return { models: uniqueSorted(models) };
  } catch (error) {
    return { models: [], error: errorMessage(error) };
  }
}

function isLikelyOpenAiChatModel(model: string) {
  return (
    model.startsWith("gpt-") ||
    model.startsWith("o") ||
    model.startsWith("chatgpt-")
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
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

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Modelov trenutno ni bilo mogoče prebrati.";
}
