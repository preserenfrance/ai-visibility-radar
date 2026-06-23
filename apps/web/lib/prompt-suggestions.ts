import { createAiAdapter } from "@ai-radar/ai";
import { parseJsonObject } from "@ai-radar/parser";
import { normalizeDomain } from "@ai-radar/shared";
import { aiModelForProvider, aiModelSettings } from "@/lib/ai-model-settings";
import { systemPromptContent } from "@/lib/system-prompts";

export type PromptSuggestionInput = {
  domain: string;
  brandName: string;
  country: string;
  language: string;
  competitors?: string;
};

type CompetitorInput = {
  name: string;
};

export async function suggestAuditPrompts(input: PromptSuggestionInput) {
  const domain = normalizeDomain(input.domain);
  const brandName = input.brandName.trim();
  const country = input.country.trim() || "Slovenija";
  const language = input.language.trim() || "sl";
  const competitors = splitCompetitors(input.competitors);

  if (!domain) throw new Error("Bad Request: vnesite domeno spletne strani.");
  if (!brandName) throw new Error("Bad Request: vnesite ime znamke.");

  const [instructions, models] = await Promise.all([
    systemPromptContent("prompt_suggestion"),
    aiModelSettings(),
  ]);
  const adapter = createAiAdapter("openai", {
    modelOverride: aiModelForProvider(models, "openai", true),
    searchEnabled: true,
  });
  const output = await adapter.runPrompt({
    prompt: buildSuggestionPrompt({
      domain,
      brandName,
      country,
      language,
      competitors,
      instructions,
    }),
    language,
    country,
    brandName,
    brandDomain: domain,
    competitors,
    searchEnabled: true,
  });

  return normalizeSuggestedPrompts(parseSuggestedJson(output.rawText));
}

function buildSuggestionPrompt(input: {
  domain: string;
  brandName: string;
  country: string;
  language: string;
  competitors: CompetitorInput[];
  instructions: string;
}) {
  return [
    "You are helping a user start an AI visibility audit.",
    "Use web search to inspect the website below before writing prompts.",
    "",
    "Admin instructions for prompt generation:",
    input.instructions,
    "",
    `Website to inspect: https://${input.domain}`,
    `Brand name: ${input.brandName}`,
    `Target market: ${input.country}`,
    `Prompt language: ${input.language}`,
    `Known competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "none"}`,
    "",
    "Return only strict JSON. Do not wrap it in markdown.",
    "Return JSON in this exact shape:",
    `{"prompts":["...","...","...","...","..."]}`,
  ].join("\n");
}

function normalizeSuggestedPrompts(parsed: unknown) {
  const value = parsed as { prompts?: unknown };
  const rawPrompts = Array.isArray(value.prompts) ? value.prompts : [];
  const prompts: string[] = [];
  const seen = new Set<string>();

  for (const item of rawPrompts) {
    const text = normalizePromptText(extractPromptText(item));
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    prompts.push(text);
    if (prompts.length === 5) break;
  }

  if (prompts.length !== 5) {
    throw new Error(
      "Bad Request: ChatGPT ni vrnil petih uporabnih predlogov promptov.",
    );
  }

  return prompts;
}

function parseSuggestedJson(value: string) {
  try {
    return parseJsonObject(value);
  } catch {
    throw new Error("Bad Request: ChatGPT ni vrnil veljavnih predlogov.");
  }
}

function extractPromptText(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.prompt === "string") return record.prompt;
  if (typeof record.text === "string") return record.text;
  return "";
}

function normalizePromptText(value: string) {
  const text = value
    .replace(/^\s*(?:\d+[\).:-]\s*|[-*]\s+)/, "")
    .replace(/\s+/g, " ")
    .trim();
  return firstSentence(text);
}

function firstSentence(value: string) {
  const questionEnd = value.indexOf("?");
  if (questionEnd >= 0) return value.slice(0, questionEnd + 1).trim();

  const exclamationEnd = value.indexOf("!");
  if (exclamationEnd >= 0) return value.slice(0, exclamationEnd + 1).trim();

  const periodMatch = value.match(/\.(?:\s|$)/);
  if (periodMatch?.index === undefined) return value;
  return value.slice(0, periodMatch.index + 1).trim();
}

function splitCompetitors(value?: string) {
  return (
    value
      ?.split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map((name) => ({ name })) ?? []
  );
}
