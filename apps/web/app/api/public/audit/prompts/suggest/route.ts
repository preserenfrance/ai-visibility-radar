import { createAiAdapter } from "@ai-radar/ai";
import { parseJsonObject } from "@ai-radar/parser";
import { normalizeDomain } from "@ai-radar/shared";
import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http";

export const maxDuration = 60;

const schema = z.object({
  domain: z.string().min(3),
  brandName: z.string().min(1),
  country: z.string().default("Slovenija"),
  language: z.string().default("sl"),
  competitors: z.string().optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const domain = normalizeDomain(input.domain);
    const brandName = input.brandName.trim();
    const country = input.country.trim() || "Slovenija";
    const language = input.language.trim() || "sl";
    const competitors = splitCompetitors(input.competitors);
    const adapter = createAiAdapter("openai", { searchEnabled: true });

    if (!domain) throw new Error("Bad Request: vnesite domeno spletne strani.");

    const output = await adapter.runPrompt({
      prompt: buildSuggestionPrompt({
        domain,
        brandName,
        country,
        language,
        competitors,
      }),
      language,
      country,
      brandName,
      brandDomain: domain,
      competitors,
      searchEnabled: true,
    });

    const prompts = normalizeSuggestedPrompts(
      parseSuggestedJson(output.rawText),
    );
    return ok({ prompts });
  });
}

function buildSuggestionPrompt(input: {
  domain: string;
  brandName: string;
  country: string;
  language: string;
  competitors: Array<{ name: string }>;
}) {
  return [
    "You are helping a user start an AI visibility audit.",
    "Use web search to inspect the website below before writing prompts.",
    "",
    `Website to inspect: https://${input.domain}`,
    `Brand name: ${input.brandName}`,
    `Target market: ${input.country}`,
    `Prompt language: ${input.language}`,
    `Known competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "none"}`,
    "",
    "Create exactly 5 buyer-style prompts that would be useful for testing whether ChatGPT, Gemini, or Claude recommend this brand.",
    "The prompts must reflect the actual offer, product category, buyer intent, and market context you find on the website.",
    "Each prompt must be concrete, concise, and no longer than one sentence.",
    "Write one direct question per prompt. Do not include explanations, follow-up questions, or multiple tasks in the same prompt.",
    "Prefer discovery, comparison, problem, alternatives, local-fit, or provider-selection questions.",
    "Use competitor names only when they make the prompt more realistic.",
    "Include at most one prompt that mentions the tested brand by name.",
    "Do not write SEO keyword fragments, internal slogans, tracking tasks, or questions about website analytics.",
    "Do not number the prompt strings.",
    "Return only strict JSON. Do not wrap it in markdown.",
    "",
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
  if (!periodMatch?.index) return value;
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
