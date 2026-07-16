import { createAiAdapter } from "@ai-radar/ai";
import { getConfig } from "@ai-radar/config";
import { parseJsonObject } from "@ai-radar/parser";
import { aiModelForProvider, aiModelSettings } from "@/lib/ai-model-settings";

export type PromptGapSuggestion = {
  text: string;
  category: string;
  reason: string;
};

export type PromptGapRun = {
  prompt: string;
  engineName: string;
  brandMentioned: boolean | null;
  brandRank: number | null;
  mentionCount: number;
  competitors: string[];
  citations: string[];
  searchQueries: string[];
};

export type PromptGapInput = {
  brandName: string;
  domain: string;
  industry?: string | null;
  country: string;
  language: string;
  competitors: Array<{ name: string; domain?: string | null }>;
  existingPrompts: string[];
  latestRuns: PromptGapRun[];
  maxSuggestions?: number;
};

const DEFAULT_MAX_SUGGESTIONS = 5;

export async function suggestPromptGaps(input: PromptGapInput) {
  const maxSuggestions = Math.max(
    1,
    Math.min(input.maxSuggestions ?? DEFAULT_MAX_SUGGESTIONS, 5),
  );
  const fallback = ruleBasedPromptGaps(input, maxSuggestions);
  const config = getConfig();
  if (!config.OPENAI_API_KEY) return fallback;

  try {
    const models = await aiModelSettings();
    const adapter = createAiAdapter("openai", {
      modelOverride: aiModelForProvider(models, "openai", false),
      searchEnabled: false,
    });
    const output = await adapter.runPrompt({
      prompt: buildPromptGapPrompt(input, fallback, maxSuggestions),
      language: input.language,
      country: input.country,
      brandName: input.brandName,
      brandDomain: input.domain,
      competitors: input.competitors.map((competitor) => ({
        name: competitor.name,
        domain: competitor.domain ?? undefined,
      })),
      searchEnabled: false,
    });
    return normalizePromptGapSuggestions(
      parseJsonObject(output.rawText),
      input,
      fallback,
      maxSuggestions,
    );
  } catch (error) {
    console.error("Prompt gap generation fell back to rules", error);
    return fallback;
  }
}

function buildPromptGapPrompt(
  input: PromptGapInput,
  fallback: PromptGapSuggestion[],
  maxSuggestions: number,
) {
  return [
    "You are an AI visibility strategist.",
    "Suggest missing buyer prompts that would reveal gaps in how AI assistants recommend, cite, or compare this brand.",
    "",
    `Brand: ${input.brandName}`,
    `Domain: ${input.domain}`,
    `Industry: ${input.industry || "unknown"}`,
    `Market: ${input.country}`,
    `Prompt language: ${input.language}`,
    `Known competitors: ${input.competitors.map((item) => item.name).join(", ") || "none"}`,
    "",
    "Existing prompts:",
    input.existingPrompts
      .slice(0, 60)
      .map((prompt) => `- ${prompt}`)
      .join("\n") || "- none",
    "",
    "Recent scan signals:",
    input.latestRuns.slice(0, 40).map(runSignal).join("\n") ||
      "- no scan data yet",
    "",
    "Fallback examples you may improve:",
    fallback
      .map((suggestion) => `- ${suggestion.text} (${suggestion.reason})`)
      .join("\n"),
    "",
    "Rules:",
    "- Return buyer-style questions only.",
    "- Do not repeat or lightly reword existing prompts.",
    "- Focus on gaps: missing brand mentions, competitor comparisons, citation opportunities, and purchase intent.",
    "- Write prompts in the requested prompt language.",
    "- Keep each prompt under 160 characters.",
    "",
    "Return only strict JSON. Do not wrap it in markdown.",
    "Return JSON in this exact shape:",
    `{"suggestions":[{"text":"...","category":"comparison","reason":"..."}]}`,
    `Return exactly ${maxSuggestions} suggestions.`,
  ].join("\n");
}

function runSignal(run: PromptGapRun) {
  return [
    `- Prompt: ${run.prompt}`,
    `model=${run.engineName}`,
    `brandMentioned=${run.brandMentioned ?? "unknown"}`,
    `rank=${run.brandRank ?? "none"}`,
    `mentions=${run.mentionCount}`,
    `competitors=${run.competitors.join(", ") || "none"}`,
    `citations=${run.citations.join(", ") || "none"}`,
    `queries=${run.searchQueries.join(" | ") || "none"}`,
  ].join("; ");
}

function normalizePromptGapSuggestions(
  parsed: unknown,
  input: PromptGapInput,
  fallback: PromptGapSuggestion[],
  maxSuggestions: number,
) {
  const record = isObjectRecord(parsed) ? parsed : {};
  const rawSuggestions = Array.isArray(record.suggestions)
    ? record.suggestions
    : [];
  const suggestions: PromptGapSuggestion[] = [];
  const seen = new Set(input.existingPrompts.map(normalizeKey));

  for (const raw of rawSuggestions) {
    const suggestion = normalizePromptGapSuggestion(raw);
    if (!suggestion) continue;
    const key = normalizeKey(suggestion.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= maxSuggestions) break;
  }

  for (const suggestion of fallback) {
    const key = normalizeKey(suggestion.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= maxSuggestions) break;
  }

  return suggestions;
}

function normalizePromptGapSuggestion(value: unknown) {
  if (typeof value === "string") {
    return {
      text: normalizePromptText(value),
      category: "gap",
      reason: "Suggested missing buyer question.",
    };
  }
  if (!isObjectRecord(value)) return null;
  const text = normalizePromptText(
    stringValue(value.text) || stringValue(value.prompt),
  );
  if (!text) return null;
  return {
    text,
    category: normalizeLabel(stringValue(value.category) || "gap"),
    reason:
      normalizeSentence(stringValue(value.reason)) ||
      "Suggested missing buyer question.",
  };
}

function ruleBasedPromptGaps(
  input: PromptGapInput,
  maxSuggestions: number,
): PromptGapSuggestion[] {
  const competitor = mostRelevantCompetitor(input);
  const need = buyerNeed(input);
  const missingBrandRuns = input.latestRuns.filter(
    (run) => run.brandMentioned === false,
  ).length;
  const citationPoorRuns = input.latestRuns.filter(
    (run) => run.brandMentioned && run.citations.length === 0,
  ).length;
  const useSlovenian = input.language.toLowerCase().startsWith("sl");
  const templates = useSlovenian
    ? slovenianTemplates(input, competitor, need)
    : englishTemplates(input, competitor, need);

  const suggestions = [
    {
      text: templates.comparison,
      category: "comparison",
      reason: competitor
        ? `Tests direct comparison against ${competitor.name}.`
        : "Tests direct comparison language where AI answers often choose a winner.",
    },
    {
      text: templates.bestFor,
      category: "best_for",
      reason:
        missingBrandRuns > 0
          ? "Recent scans had prompts where the brand was not mentioned."
          : "Adds a non-branded purchase-intent prompt.",
    },
    {
      text: templates.alternative,
      category: "competitor_alternative",
      reason: competitor
        ? `Checks whether ${input.brandName} appears as an alternative to ${competitor.name}.`
        : "Checks whether the brand appears in alternative-provider answers.",
    },
    {
      text: templates.citation,
      category: "citation",
      reason:
        citationPoorRuns > 0
          ? "Recent scans found brand mentions without strong citation support."
          : "Tests whether AI can cite credible proof for the brand.",
    },
    {
      text: templates.problem,
      category: "problem",
      reason:
        "Adds a problem-led buyer question instead of only category terms.",
    },
  ];

  const seen = new Set(input.existingPrompts.map(normalizeKey));
  return suggestions
    .map((suggestion) => ({
      ...suggestion,
      text: normalizePromptText(suggestion.text),
    }))
    .filter((suggestion) => {
      const key = normalizeKey(suggestion.text);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxSuggestions);
}

function slovenianTemplates(
  input: PromptGapInput,
  competitor: { name: string } | null,
  need: string,
) {
  const competitorName = competitor?.name ?? "najvecjim konkurentom";
  return {
    comparison: `Kako se ${input.brandName} primerja z ${competitorName} za ${need} v ${input.country}?`,
    bestFor: `Kateri ponudnik je najboljsa izbira za ${need} v ${input.country}?`,
    alternative: `Katere so najboljse alternative za ${competitorName} pri ${need}?`,
    citation: `Kateri viri dokazujejo, da je ${input.brandName} zanesljiva izbira za ${need}?`,
    problem: `Kaj naj kupec preveri pred izbiro ponudnika za ${need}?`,
  };
}

function englishTemplates(
  input: PromptGapInput,
  competitor: { name: string } | null,
  need: string,
) {
  const competitorName = competitor?.name ?? "the leading competitors";
  return {
    comparison: `How does ${input.brandName} compare with ${competitorName} for ${need} in ${input.country}?`,
    bestFor: `Which provider is the best choice for ${need} in ${input.country}?`,
    alternative: `What are the best alternatives to ${competitorName} for ${need}?`,
    citation: `Which sources prove that ${input.brandName} is a reliable choice for ${need}?`,
    problem: `What should a buyer check before choosing a provider for ${need}?`,
  };
}

function mostRelevantCompetitor(input: PromptGapInput) {
  const counts = new Map<string, number>();
  for (const run of input.latestRuns) {
    for (const competitor of run.competitors) {
      counts.set(competitor, (counts.get(competitor) ?? 0) + 1);
    }
  }
  const fromRuns = [...counts.entries()].sort(
    ([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount || leftName.localeCompare(rightName),
  )[0]?.[0];
  if (fromRuns) return { name: fromRuns };
  return input.competitors[0] ? { name: input.competitors[0].name } : null;
}

function buyerNeed(input: PromptGapInput) {
  const industry = input.industry?.trim();
  if (!industry) return "a solution like this";
  return industry.length > 70 ? "this type of solution" : industry;
}

function normalizePromptText(value: string) {
  return normalizeSentence(value)
    .replace(/^\s*(?:\d+[\).:-]\s*|[-*]\s+)/, "")
    .trim();
}

function normalizeSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLabel(value: string) {
  return value
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
