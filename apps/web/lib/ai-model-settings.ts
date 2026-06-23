import { getConfig } from "@ai-radar/config";
import { prisma } from "@ai-radar/db";
import type { AiEngineProvider } from "@ai-radar/shared";

const AI_MODEL_SETTINGS_KEY = "ai_model_settings";

export type AiModelProvider = Extract<
  AiEngineProvider,
  "openai" | "google" | "anthropic"
>;

export type AiModelSettings = Record<AiModelProvider, string>;

export type AiModelOptionGroup = {
  provider: AiModelProvider;
  label: string;
  models: string[];
  currentModel: string;
  error?: string;
};

export const AI_MODEL_PROVIDER_LABELS: Record<AiModelProvider, string> = {
  openai: "OpenAI / ChatGPT",
  google: "Google / Gemini",
  anthropic: "Anthropic / Claude",
};

const FALLBACK_MODELS: AiModelSettings = {
  openai: "gpt-4o-mini",
  google: "gemini-1.5-flash",
  anthropic: "claude-3-5-sonnet-latest",
};

export async function aiModelSettings(): Promise<AiModelSettings> {
  const config = getConfig();
  const defaults: AiModelSettings = {
    openai: config.OPENAI_MODEL ?? FALLBACK_MODELS.openai,
    google: config.GEMINI_MODEL ?? FALLBACK_MODELS.google,
    anthropic: config.CLAUDE_MODEL ?? FALLBACK_MODELS.anthropic,
  };
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
  settings: Partial<AiModelSettings>,
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

export async function availableAiModels(): Promise<AiModelOptionGroup[]> {
  const [settings, openai, google, anthropic] = await Promise.all([
    aiModelSettings(),
    fetchOpenAiModels(),
    fetchGeminiModels(),
    fetchClaudeModels(),
  ]);

  return [
    withCurrentModel("openai", settings.openai, openai),
    withCurrentModel("google", settings.google, google),
    withCurrentModel("anthropic", settings.anthropic, anthropic),
  ];
}

function normalizeModelSettings(
  value: unknown,
  defaults: AiModelSettings,
): AiModelSettings {
  const candidate = value as Partial<Record<AiModelProvider, unknown>>;
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

function withCurrentModel(
  provider: AiModelProvider,
  currentModel: string,
  result: { models: string[]; error?: string },
): AiModelOptionGroup {
  const models = uniqueSorted([currentModel, ...result.models].filter(Boolean));
  return {
    provider,
    label: AI_MODEL_PROVIDER_LABELS[provider],
    currentModel,
    models,
    error: result.error,
  };
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
