export type AiEngineProvider = "openai" | "google" | "anthropic" | "mock";

export type Plan = "free" | "starter" | "growth" | "disabled";

export const DEFAULT_LOCALE = "sl";
export const SUPPORTED_LOCALES = ["sl", "en"] as const;
export const LOCALE_COOKIE_NAME = "llmvisio_locale";
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): SupportedLocale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const lower = value.trim().toLowerCase();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("sl")) return "sl";
  return DEFAULT_LOCALE;
}

export type PromptCategory =
  | "category"
  | "problem"
  | "comparison"
  | "best_for"
  | "local"
  | "branded"
  | "competitor_alternative";

export type Sentiment = "positive" | "neutral" | "mixed" | "negative";

export type RecommendationStrength = "none" | "low" | "medium" | "high";

export type RunPromptInput = {
  prompt: string;
  language: string;
  country: string;
  brandName: string;
  brandDomain: string;
  competitors: Array<{
    name: string;
    domain?: string;
  }>;
  searchEnabled: boolean;
};

export type AiCitation = {
  url: string;
  title?: string;
  domain?: string;
};

export type RunPromptOutput = {
  provider: AiEngineProvider;
  model: string;
  rawText: string;
  rawJson: unknown;
  citations: AiCitation[];
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
};

export interface AiEngineAdapter {
  runPrompt(input: RunPromptInput): Promise<RunPromptOutput>;
}

export type CrawledPageSnapshot = {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  h2: string[];
  mainText?: string;
  schemaJson?: unknown;
  statusCode: number;
  canonicalUrl?: string;
  discoveredAt: string;
  links?: string[];
};

export type CrawlResult = {
  domain: string;
  pages: CrawledPageSnapshot[];
  robotsTxt?: string;
  sitemapUrl?: string;
  failed: boolean;
  errorMessage?: string;
};

export type GeneratedPrompt = {
  text: string;
  category: PromptCategory;
  intent: string;
  persona: string;
  funnelStage: "awareness" | "consideration" | "decision";
  priority: number;
  language: string;
  country: string;
};

export type ParserCitation = {
  url: string;
  domain: string;
  title?: string;
  supportsBrand: boolean;
  supportsCompetitor: boolean;
  isOwnedDomain: boolean;
  isCompetitorDomain: boolean;
};

export type CompetitorMention = {
  name: string;
  rank: number | null;
  sentiment: Sentiment;
  evidenceText: string;
};

export type ParserEvidence = {
  text: string;
  type: "brand_mention" | "competitor_mention" | "citation" | "accuracy_issue";
};

export type ParsedAiResult = {
  brandMentioned: boolean;
  brandRank: number | null;
  mentionCount: number;
  recommendationStrength: RecommendationStrength;
  sentiment: Sentiment;
  accuracyScore: number;
  accuracyIssues: string[];
  competitorsMentioned: CompetitorMention[];
  citations: ParserCitation[];
  evidence: ParserEvidence[];
  confidence: number;
};

export type ScoreInputResult = Pick<
  ParsedAiResult,
  | "brandMentioned"
  | "brandRank"
  | "mentionCount"
  | "sentiment"
  | "accuracyScore"
  | "competitorsMentioned"
  | "citations"
>;

export type ScoreBreakdown = {
  visibilityScore: number;
  mentionScore: number;
  rankScore: number;
  citationScore: number;
  shareOfVoiceScore: number;
  sentimentScore: number;
  accuracyScore: number;
};

export const ENGINE_PROVIDERS: AiEngineProvider[] = [
  "openai",
  "google",
  "anthropic",
];

export const FREE_AUDIT_LIMITS = {
  maxPages: 10,
  promptCount: 3,
  repeatCount: 1,
} as const;

export const MVP_LIMITS = {
  maxPages: 50,
  promptCount: 25,
  repeatCount: 1,
} as const;

export const JOB_NAMES = {
  crawlDomain: "crawl_domain",
  generatePrompts: "generate_prompts",
  createScan: "create_scan",
  runPrompt: "run_prompt",
  parseResponse: "parse_response",
  scoreScan: "score_scan",
  generateRecommendations: "generate_recommendations",
  sendEmailReport: "send_email_report",
  syncLeadToAdmin: "sync_lead_to_admin",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export function domainFromUrl(value: string): string | undefined {
  try {
    const url = value.startsWith("http")
      ? new URL(value)
      : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}
