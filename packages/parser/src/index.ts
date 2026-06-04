import { createAiAdapter } from "@ai-radar/ai";
import {
  domainFromUrl,
  type AiCitation,
  type AiEngineProvider,
  type ParsedAiResult,
  type ParserCitation,
  type Sentiment
} from "@ai-radar/shared";
import { z } from "zod";

export type ParseAiResponseInput = {
  brandName: string;
  brandDomain: string;
  brandAliases?: string[];
  competitors: Array<{ name: string; domain?: string | null }>;
  knownBrandFacts?: string[];
  prompt: string;
  rawAiAnswer: string;
  citations: AiCitation[];
  parserProvider?: AiEngineProvider;
  parserModel?: string;
};

export const parsedAiResultSchema = z.object({
  brandMentioned: z.boolean(),
  brandRank: z.number().int().positive().nullable(),
  mentionCount: z.number().int().min(0),
  recommendationStrength: z.enum(["none", "low", "medium", "high"]),
  sentiment: z.enum(["positive", "neutral", "mixed", "negative"]),
  accuracyScore: z.number().int().min(0).max(100),
  accuracyIssues: z.array(z.string()),
  competitorsMentioned: z.array(
    z.object({
      name: z.string(),
      rank: z.number().int().positive().nullable(),
      sentiment: z.enum(["positive", "neutral", "mixed", "negative"]),
      evidenceText: z.string()
    })
  ),
  citations: z.array(
    z.object({
      url: z.string(),
      domain: z.string(),
      title: z.string().optional(),
      supportsBrand: z.boolean(),
      supportsCompetitor: z.boolean(),
      isOwnedDomain: z.boolean(),
      isCompetitorDomain: z.boolean()
    })
  ),
  evidence: z.array(
    z.object({
      text: z.string(),
      type: z.enum(["brand_mention", "competitor_mention", "citation", "accuracy_issue"])
    })
  ),
  confidence: z.number().min(0).max(1)
});

export async function parseAiResponse(input: ParseAiResponseInput): Promise<ParsedAiResult> {
  if (!input.parserProvider || input.parserProvider === "mock") {
    return parsedAiResultSchema.parse(parseWithRules(input));
  }

  const adapter = createAiAdapter(input.parserProvider, {
    modelOverride: input.parserModel,
    searchEnabled: false
  });

  const parserPrompt = buildParserPrompt(input);
  const output = await adapter.runPrompt({
    prompt: parserPrompt,
    language: "en",
    country: input.brandDomain,
    brandName: input.brandName,
    brandDomain: input.brandDomain,
    competitors: input.competitors.map((competitor) => ({
      name: competitor.name,
      domain: competitor.domain ?? undefined
    })),
    searchEnabled: false
  });

  const parsed = parseJsonObject(output.rawText);
  return parsedAiResultSchema.parse(parsed);
}

export function parseWithRules(input: ParseAiResponseInput): ParsedAiResult {
  const names = [input.brandName, ...(input.brandAliases ?? [])].filter(Boolean);
  const lowerAnswer = input.rawAiAnswer.toLowerCase();
  const brandMentioned = names.some((name) => lowerAnswer.includes(name.toLowerCase()));
  const mentionCount = names.reduce(
    (sum, name) => sum + countOccurrences(input.rawAiAnswer, name),
    0
  );
  const brandRank = brandMentioned ? findRank(input.rawAiAnswer, names) : null;
  const competitorsMentioned = input.competitors
    .map((competitor) => {
      const mentioned = lowerAnswer.includes(competitor.name.toLowerCase());
      if (!mentioned) return null;
      return {
        name: competitor.name,
        rank: findRank(input.rawAiAnswer, [competitor.name]),
        sentiment: detectSentiment(input.rawAiAnswer, competitor.name),
        evidenceText: evidenceFor(input.rawAiAnswer, competitor.name)
      };
    })
    .filter((value): value is ParsedAiResult["competitorsMentioned"][number] => value !== null);

  const sentiment = brandMentioned ? detectSentiment(input.rawAiAnswer, input.brandName) : "neutral";
  const citations = classifyCitations(input.citations, {
    brandDomain: input.brandDomain,
    brandMentioned,
    competitors: input.competitors
  });
  const accuracyIssues = detectAccuracyIssues(input);

  return {
    brandMentioned,
    brandRank,
    mentionCount,
    recommendationStrength: recommendationStrength(brandMentioned, sentiment, brandRank),
    sentiment,
    accuracyScore: brandMentioned ? Math.max(30, 100 - accuracyIssues.length * 20) : 0,
    accuracyIssues,
    competitorsMentioned,
    citations,
    evidence: buildEvidence(input.rawAiAnswer, input.brandName, brandMentioned, competitorsMentioned),
    confidence: brandMentioned || competitorsMentioned.length > 0 ? 0.78 : 0.62
  };
}

export function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const objectMatch = value.match(/\{[\s\S]*\}/);
    if (!objectMatch) throw new Error("Parser model did not return JSON");
    return JSON.parse(repairJson(objectMatch[0]!));
  }
}

function buildParserPrompt(input: ParseAiResponseInput): string {
  return [
    "You are an extraction parser. Return only strict JSON matching this TypeScript shape:",
    `{
  "brandMentioned": boolean,
  "brandRank": number | null,
  "mentionCount": number,
  "recommendationStrength": "none" | "low" | "medium" | "high",
  "sentiment": "positive" | "neutral" | "mixed" | "negative",
  "accuracyScore": number,
  "accuracyIssues": string[],
  "competitorsMentioned": [{"name": string, "rank": number | null, "sentiment": "positive" | "neutral" | "mixed" | "negative", "evidenceText": string}],
  "citations": [{"url": string, "domain": string, "title": string, "supportsBrand": boolean, "supportsCompetitor": boolean, "isOwnedDomain": boolean, "isCompetitorDomain": boolean}],
  "evidence": [{"text": string, "type": "brand_mention" | "competitor_mention" | "citation" | "accuracy_issue"}],
  "confidence": number
}`,
    "Rules: use only the raw answer, prompt, citations, and known brand facts below. Do not use your own knowledge. If unsure, lower confidence. If brand is not mentioned, brandRank must be null.",
    `Brand: ${input.brandName}`,
    `Brand domain: ${input.brandDomain}`,
    `Aliases: ${(input.brandAliases ?? []).join(", ") || "none"}`,
    `Competitors: ${JSON.stringify(input.competitors)}`,
    `Known brand facts: ${JSON.stringify(input.knownBrandFacts ?? [])}`,
    `Prompt: ${input.prompt}`,
    `Citations: ${JSON.stringify(input.citations)}`,
    `Raw answer: ${input.rawAiAnswer}`
  ].join("\n\n");
}

function classifyCitations(
  citations: AiCitation[],
  context: {
    brandDomain: string;
    brandMentioned: boolean;
    competitors: Array<{ name: string; domain?: string | null }>;
  }
): ParserCitation[] {
  const ownedDomain = context.brandDomain.replace(/^www\./, "").toLowerCase();
  const competitorDomains = new Set(
    context.competitors
      .map((competitor) => competitor.domain?.replace(/^www\./, "").toLowerCase())
      .filter((domain): domain is string => Boolean(domain))
  );

  return citations.map((citation) => {
    const domain = citation.domain ?? domainFromUrl(citation.url) ?? "";
    const cleanDomain = domain.replace(/^www\./, "").toLowerCase();
    const isOwnedDomain = cleanDomain === ownedDomain || cleanDomain.endsWith(`.${ownedDomain}`);
    const isCompetitorDomain = competitorDomains.has(cleanDomain);
    return {
      url: citation.url,
      domain: cleanDomain,
      title: citation.title,
      supportsBrand: context.brandMentioned && !isCompetitorDomain,
      supportsCompetitor: isCompetitorDomain,
      isOwnedDomain,
      isCompetitorDomain
    };
  });
}

function findRank(text: string, names: string[]): number | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const numbered = line.match(/^\s*(?:#?\s*)?(\d+)[\).\-\s:]+(.+)$/);
    if (!numbered) continue;
    const content = numbered[2]!.toLowerCase();
    if (names.some((name) => content.includes(name.toLowerCase()))) {
      return Number(numbered[1]);
    }
  }

  const sentence = text.toLowerCase();
  const positions = names.map((name) => sentence.indexOf(name.toLowerCase())).filter((index) => index >= 0);
  if (positions.length === 0) return null;
  return 1;
}

function detectSentiment(text: string, entityName: string): Sentiment {
  const evidence = evidenceFor(text, entityName).toLowerCase();
  const negative = ["slab", "napa", "drago", "weak", "poor", "negative", "not recommended"];
  const positive = ["best", "najbolj", "priporo", "strong", "vodil", "good", "excellent"];
  const hasNegative = negative.some((term) => evidence.includes(term));
  const hasPositive = positive.some((term) => evidence.includes(term));
  if (hasNegative && hasPositive) return "mixed";
  if (hasNegative) return "negative";
  if (hasPositive) return "positive";
  return "neutral";
}

function recommendationStrength(
  brandMentioned: boolean,
  sentiment: Sentiment,
  rank: number | null
): ParsedAiResult["recommendationStrength"] {
  if (!brandMentioned) return "none";
  if (sentiment === "negative") return "low";
  if (rank === 1 && sentiment === "positive") return "high";
  if (rank !== null && rank <= 3) return "medium";
  return "low";
}

function evidenceFor(text: string, entityName: string): string {
  const sentence = text
    .split(/(?<=[.!?])\s+|\r?\n/)
    .find((part) => part.toLowerCase().includes(entityName.toLowerCase()));
  return sentence?.trim().slice(0, 500) ?? "";
}

function buildEvidence(
  rawAiAnswer: string,
  brandName: string,
  brandMentioned: boolean,
  competitorsMentioned: ParsedAiResult["competitorsMentioned"]
): ParsedAiResult["evidence"] {
  const evidence: ParsedAiResult["evidence"] = [];
  if (brandMentioned) {
    evidence.push({ text: evidenceFor(rawAiAnswer, brandName), type: "brand_mention" });
  }
  for (const competitor of competitorsMentioned) {
    evidence.push({ text: competitor.evidenceText, type: "competitor_mention" });
  }
  return evidence.filter((item) => item.text.length > 0);
}

function detectAccuracyIssues(input: ParseAiResponseInput): string[] {
  const issues: string[] = [];
  const lower = input.rawAiAnswer.toLowerCase();
  if (lower.includes("ne vem") || lower.includes("unknown")) {
    issues.push("The answer expresses uncertainty about the brand.");
  }
  if (lower.includes("not found") || lower.includes("ni najden")) {
    issues.push("The answer says the brand was not found.");
  }

  for (const fact of input.knownBrandFacts ?? []) {
    const meaningfulTokens = fact
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 5)
      .slice(0, 4);
    if (meaningfulTokens.length > 0 && meaningfulTokens.every((token) => !lower.includes(token))) {
      issues.push(`Known fact not reflected: ${fact}`);
    }
  }

  return issues.slice(0, 5);
}

function countOccurrences(text: string, needle: string): number {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(escaped, "gi"))?.length ?? 0;
}

function repairJson(value: string): string {
  return value
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/```json/g, "")
    .replace(/```/g, "");
}
