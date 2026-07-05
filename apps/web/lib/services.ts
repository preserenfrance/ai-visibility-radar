import { crawlDomain } from "@ai-radar/crawler";
import {
  prisma,
  promptRunConcurrencyLimit,
  resetStaleScanWork,
  tryStartScanRun,
} from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { createAiAdapter } from "@ai-radar/ai";
import { parseAiResponse, parseJsonObject } from "@ai-radar/parser";
import { generatePromptSet } from "@ai-radar/prompts";
import {
  calculateLeadScore,
  calculateVisibilityScore,
  generateRecommendationDrafts,
} from "@ai-radar/scoring";
import {
  ENGINE_PROVIDERS,
  FREE_AUDIT_LIMITS,
  JOB_NAMES,
  MVP_LIMITS,
  domainFromUrl,
  normalizeDomain,
  type AiEngineProvider,
  type CrawledPageSnapshot,
  type GeneratedPrompt,
  type ParsedAiResult,
  type Plan,
  type PromptCategory,
} from "@ai-radar/shared";
import { sendAuditReportEmail, sendScanCompletedEmail } from "@ai-radar/email";
import { generateSalesBrief } from "@ai-radar/reports";
import { aiModelForProvider, aiModelSettings } from "@/lib/ai-model-settings";
import {
  canRunAutomaticScans,
  canRunManualScans,
  promptLimitForOrganization,
} from "@/lib/billing";
import { enqueueJob } from "@/lib/queue";
import { systemPromptContent } from "@/lib/system-prompts";

const PROMPT_EXECUTION_TIMEOUT_MS = positiveNumberFromEnv(
  "PROMPT_EXECUTION_TIMEOUT_MS",
  30_000,
  10_000,
);
const PARSER_EXECUTION_TIMEOUT_MS = positiveNumberFromEnv(
  "PARSER_EXECUTION_TIMEOUT_MS",
  12_000,
  5_000,
);

export async function crawlBrand(
  brandId: string,
  maxPages: number = MVP_LIMITS.maxPages,
  crawlOptions: { timeoutMs?: number; rateLimitMs?: number } = {},
) {
  throw new Error("Bad Request: analiza spletne strani je izklopljena");
}

export async function generatePromptsForBrand(
  brandId: string,
  count: number = MVP_LIMITS.promptCount,
) {
  throw new Error("Bad Request: samodejno generiranje promptov je izklopljeno");
}

async function generateFastPromptsForBrand(brandId: string, count: number) {
  throw new Error("Bad Request: samodejno generiranje promptov je izklopljeno");
}

type PromptControlSettings = {
  websiteAnalysisInstructions: string;
  promptGenerationInstructions: string;
  questionBlueprint: string;
};

const USER_PROMPT_MIN_COUNT = 3;
const USER_PROMPT_MAX_COUNT = 10;
const USER_PROMPT_CATEGORY: PromptCategory = "category";
const USER_PROMPT_FUNNEL_STAGE: GeneratedPrompt["funnelStage"] =
  "consideration";

function normalizeUserPrompts(prompts: string[]) {
  const normalized = prompts
    .map((prompt) => prompt.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  if (
    normalized.length < USER_PROMPT_MIN_COUNT ||
    normalized.length > USER_PROMPT_MAX_COUNT
  ) {
    throw new Error(
      `Bad Request: vnesite vsaj ${USER_PROMPT_MIN_COUNT} in največ ${USER_PROMPT_MAX_COUNT} promptov`,
    );
  }

  if (
    new Set(normalized.map((prompt) => prompt.toLowerCase())).size !==
    normalized.length
  ) {
    throw new Error("Bad Request: prompti se ne smejo podvajati");
  }

  if (normalized.some((prompt) => prompt.length < 3)) {
    throw new Error("Bad Request: vsak prompt mora imeti vsaj 3 znake");
  }

  return normalized;
}

async function createUserPromptSet(
  brand: { id: string; name: string; language: string; country: string },
  prompts: string[],
) {
  const normalized = normalizeUserPrompts(prompts);

  await prisma.promptSet.updateMany({
    where: { brandId: brand.id, status: "active" },
    data: { status: "archived" },
  });

  return prisma.promptSet.create({
    data: {
      brandId: brand.id,
      name: `${brand.name} uporabniški prompti`,
      language: brand.language,
      country: brand.country,
      status: "active",
      prompts: {
        create: normalized.map((text, index) => ({
          text,
          category: USER_PROMPT_CATEGORY,
          intent: "user supplied prompt",
          persona: "buyer",
          funnelStage: USER_PROMPT_FUNNEL_STAGE,
          priority: index + 1,
          isActive: true,
        })),
      },
    },
    include: { prompts: true },
  });
}

async function promptControlSettings(): Promise<PromptControlSettings> {
  const [
    websiteAnalysisInstructions,
    promptGenerationInstructions,
    questionBlueprint,
  ] = await Promise.all([
    systemPromptContent("website_analysis"),
    systemPromptContent("prompt_generation"),
    systemPromptContent("question_blueprint"),
  ]);

  return {
    websiteAnalysisInstructions,
    promptGenerationInstructions,
    questionBlueprint,
  };
}

function renderQuestionBlueprintPrompts(
  input: {
    brandName: string;
    domain: string;
    industry?: string;
    country: string;
    language: string;
    competitors: Array<{ name: string; domain?: string | null }>;
    pages: CrawledPageSnapshot[];
    count: number;
  },
  blueprint: string,
  count: number,
): GeneratedPrompt[] {
  const templates = blueprint
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return templates
    .map((template, index) => {
      const text = ensureQuestionText(renderQuestionTemplate(template, input));
      if (!text || hasMojibake(text)) return null;
      if (
        isSlovenianLanguage(input.language) &&
        !looksLikeSlovenianQuestion(text)
      )
        return null;
      const category = inferBlueprintCategory(text, input.brandName);
      return {
        text,
        category,
        intent: "admin prompt blueprint",
        persona: "buyer",
        funnelStage: funnelStageForCategory(category),
        priority: index + 1,
        language: input.language,
        country: input.country,
      };
    })
    .filter((prompt): prompt is GeneratedPrompt => Boolean(prompt))
    .slice(0, count);
}

function renderQuestionTemplate(
  template: string,
  input: {
    brandName: string;
    industry?: string;
    country: string;
    language: string;
    competitors: Array<{ name: string; domain?: string | null }>;
  },
) {
  const competitors = input.competitors
    .map((competitor) => competitor.name)
    .filter(Boolean);
  const firstCompetitor =
    competitors[0] ?? "najpogosteje omenjenega konkurenta";
  const industry = input.industry || "ustrezen produkt ali rešitev";
  return template
    .replaceAll("{brandName}", input.brandName)
    .replaceAll("{industry}", industry)
    .replaceAll("{country}", input.country)
    .replaceAll("{localMarket}", localMarketLabelForPrompt(input.country))
    .replaceAll("{language}", input.language)
    .replaceAll("{competitors}", firstCompetitor)
    .replace(/\s+/g, " ")
    .trim();
}

function mergeGeneratedPrompts(prompts: GeneratedPrompt[], count: number) {
  const seen = new Set<string>();
  const merged: GeneratedPrompt[] = [];

  for (const prompt of prompts) {
    const key = normalizePromptText(prompt.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(prompt);
    if (merged.length >= count) break;
  }

  return merged.map((prompt, index) => ({
    ...prompt,
    priority: index + 1,
  }));
}

function normalizePromptText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function inferPromptIndustry(pages: CrawledPageSnapshot[]) {
  const candidates = pages
    .slice(0, 8)
    .flatMap((page) => [
      page.h1,
      ...page.h2.slice(0, 8),
      page.title,
      page.metaDescription,
    ])
    .map(cleanIndustryCandidate)
    .filter((candidate): candidate is string => Boolean(candidate));
  const unique = uniqueStrings(candidates);
  return unique.find(containsProductCue) ?? unique[0];
}

function inferBlueprintCategory(
  text: string,
  brandName: string,
): PromptCategory {
  const lower = text.toLowerCase();
  if (brandName && lower.includes(brandName.toLowerCase())) return "branded";
  if (lower.includes("alternativ")) return "competitor_alternative";
  if (lower.includes("primerj") || lower.includes("compare"))
    return "comparison";
  if (lower.includes("najbolj") || lower.includes("best")) return "best_for";
  if (
    lower.includes("sloven") ||
    lower.includes("lokal") ||
    lower.includes("local")
  )
    return "local";
  if (
    lower.includes("kako") ||
    lower.includes("kaj mora") ||
    lower.includes("problem")
  )
    return "problem";
  return "category";
}

function funnelStageForCategory(
  category: PromptCategory,
): GeneratedPrompt["funnelStage"] {
  if (category === "branded" || category === "comparison") return "decision";
  if (
    category === "best_for" ||
    category === "competitor_alternative" ||
    category === "local"
  )
    return "consideration";
  return "awareness";
}

function localMarketLabelForPrompt(country: string) {
  const lower = country.toLowerCase();
  if (lower === "slovenia" || lower === "slovenija" || lower === "si")
    return "Sloveniji";
  return country;
}

function promptLanguageName(language: string) {
  return isSlovenianLanguage(language) ? "lepa, naravna slovenščina" : language;
}

function isSlovenianLanguage(language: string) {
  const lower = language.toLowerCase();
  return lower === "sl" || lower.includes("sloven");
}

function ensureQuestionText(value: string) {
  const text = value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/, "");
  return text.endsWith("?") ? text : `${text}?`;
}

function hasMojibake(value: string) {
  return /[�]|Ä|Ĺ|Å|Â|Ã/.test(value);
}

function looksLikeSlovenianQuestion(value: string) {
  const lower = value.toLowerCase();
  return /^(kateri|katere|katero|kakšen|kaksen|kakšna|kaksna|kako|kaj|kdo|kje|kdaj|zakaj|koliko|ali|na kaj|za katere|primerjaj)\b/.test(
    lower,
  );
}

function cleanIndustryCandidate(value: string | null | undefined) {
  if (!value) return undefined;
  const cleaned = value
    .replace(/\s+/g, " ")
    .split(/\s[|–—]\s/)[0]!
    .replace(/^[\s:;,.!?-]+|[\s:;,.!?-]+$/g, "")
    .trim();
  if (cleaned.length < 5 || cleaned.length > 100) return undefined;
  if (hasMojibake(cleaned)) return undefined;
  if (isGenericIndustryCandidate(cleaned)) return undefined;
  return /^[A-ZČŠŽ][a-zčšž]/.test(cleaned)
    ? cleaned.charAt(0).toLowerCase() + cleaned.slice(1)
    : cleaned;
}

function isGenericIndustryCandidate(value: string) {
  const lower = value.toLowerCase();
  const genericTerms = [
    "domov",
    "home",
    "o nas",
    "about",
    "kontakt",
    "contact",
    "blog",
    "novice",
    "faq",
    "cenik",
    "pricing",
    "prijava",
    "login",
    "zasebnost",
    "privacy",
    "pogoji",
    "terms",
    "piškotki",
    "cookie",
  ];
  return genericTerms.some(
    (term) => lower === term || lower.startsWith(`${term} `),
  );
}

function containsProductCue(value: string) {
  const lower = value.toLowerCase();
  return [
    "produkt",
    "izdelek",
    "rešitev",
    "storitev",
    "platforma",
    "programska oprema",
    "aplikacija",
    "orodje",
    "software",
    "product",
    "solution",
    "service",
    "platform",
    "tool",
  ].some((term) => lower.includes(term));
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  "category",
  "problem",
  "comparison",
  "best_for",
  "local",
  "branded",
  "competitor_alternative",
];

const FUNNEL_STAGES: GeneratedPrompt["funnelStage"][] = [
  "awareness",
  "consideration",
  "decision",
];

async function generatePromptSetWithChatGpt(
  input: {
    brandName: string;
    domain: string;
    industry?: string;
    country: string;
    language: string;
    competitors: Array<{ name: string; domain?: string | null }>;
    pages: CrawledPageSnapshot[];
    count: number;
  },
  settings: PromptControlSettings,
): Promise<GeneratedPrompt[]> {
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for ChatGPT prompt generation");
  }

  const models = await aiModelSettings();
  const adapter = createAiAdapter("openai", {
    modelOverride: aiModelForProvider(models, "openai", false),
    searchEnabled: false,
  });

  const output = await adapter.runPrompt({
    prompt: buildPromptGenerationPrompt(input, settings),
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

  const parsed = parseJsonObject(output.rawText);
  const generated = normalizeChatGptPrompts(parsed, input);
  if (generated.length === 0) {
    throw new Error("ChatGPT returned no valid prompts");
  }
  return generated.slice(0, input.count);
}

function buildPromptGenerationPrompt(
  input: {
    brandName: string;
    domain: string;
    industry?: string;
    country: string;
    language: string;
    competitors: Array<{ name: string; domain?: string | null }>;
    pages: CrawledPageSnapshot[];
    count: number;
  },
  settings: PromptControlSettings,
) {
  return [
    "Website analysis instructions:",
    settings.websiteAnalysisInstructions,
    "",
    "AI question generation instructions:",
    settings.promptGenerationInstructions,
    "",
    "You generate AI visibility test prompts for one specific website.",
    "Return only strict JSON. Do not wrap it in markdown.",
    "",
    `Website under analysis: ${input.brandName} (${input.domain})`,
    `Target market: ${input.country}`,
    `Prompt language: ${promptLanguageName(input.language)}`,
    `Known competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "none"}`,
    "",
    "Use only the website context below. Do not use SEOS, seos.si, AI Visibility Radar, or marketing/SEO topics unless they are clearly present in this website context.",
    "Create practical product-oriented prompts that real buyers would ask ChatGPT, Gemini, or Claude when looking for a provider, product, service, alternative, comparison, or solution like this website.",
    "Prioritize product choice, features, price, support, implementation, proof, local fit, limitations, and alternatives.",
    "Most prompts should be discovery/comparison/problem prompts and should not mention the measured brand by name. Include at most two branded prompts.",
    isSlovenianLanguage(input.language)
      ? "All prompt text values must be in natural Slovenian with correct č, š and ž. Do not return English questions."
      : "",
    "Every text value must be a question a buyer could actually ask. Avoid SEO keyword fragments and internal company slogans.",
    `Generate exactly ${input.count} prompts.`,
    input.industry ? `Detected industry/category: ${input.industry}` : "",
    "",
    "Every prompt must be an object with:",
    `text: string, category: one of ${PROMPT_CATEGORIES.join(", ")}, intent: string, persona: string, funnelStage: one of ${FUNNEL_STAGES.join(", ")}`,
    "",
    "Return JSON in this exact shape:",
    `{"prompts":[{"text":"...","category":"category","intent":"...","persona":"...","funnelStage":"awareness"}]}`,
    "",
    "Admin question blueprint. Use these patterns as priority examples and adapt them to the website context:",
    settings.questionBlueprint,
    "",
    "Website context:",
    JSON.stringify(buildWebsiteContext(input.pages), null, 2),
  ].join("\n");
}

function buildWebsiteContext(pages: CrawledPageSnapshot[]) {
  return pages.slice(0, 10).map((page) => ({
    url: page.url,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    h2: page.h2.slice(0, 8),
    textSample: page.mainText?.replace(/\s+/g, " ").trim().slice(0, 1200),
  }));
}

function normalizeChatGptPrompts(
  parsed: unknown,
  input: {
    country: string;
    language: string;
    count: number;
  },
): GeneratedPrompt[] {
  const value = parsed as { prompts?: unknown };
  const rawPrompts = Array.isArray(value.prompts)
    ? value.prompts
    : Array.isArray(parsed)
      ? parsed
      : [];

  return rawPrompts
    .map((item, index) => normalizeChatGptPrompt(item, index, input))
    .filter((prompt): prompt is GeneratedPrompt => Boolean(prompt));
}

function normalizeChatGptPrompt(
  item: unknown,
  index: number,
  input: {
    country: string;
    language: string;
  },
): GeneratedPrompt | null {
  if (!item || typeof item !== "object") return null;
  const draft = item as Record<string, unknown>;
  const text = ensureQuestionText(
    typeof draft.text === "string" ? draft.text.trim() : "",
  );
  if (text.length < 8) return null;
  if (hasMojibake(text)) return null;
  if (isSlovenianLanguage(input.language) && !looksLikeSlovenianQuestion(text))
    return null;

  return {
    text,
    category: promptCategory(draft.category),
    intent:
      typeof draft.intent === "string" && draft.intent.trim()
        ? draft.intent.trim()
        : "buyer discovery",
    persona:
      typeof draft.persona === "string" && draft.persona.trim()
        ? draft.persona.trim()
        : "buyer",
    funnelStage: funnelStage(draft.funnelStage),
    priority: index + 1,
    language: input.language,
    country: input.country,
  };
}

function promptCategory(value: unknown): PromptCategory {
  return PROMPT_CATEGORIES.includes(value as PromptCategory)
    ? (value as PromptCategory)
    : "category";
}

function funnelStage(value: unknown): GeneratedPrompt["funnelStage"] {
  return FUNNEL_STAGES.includes(value as GeneratedPrompt["funnelStage"])
    ? (value as GeneratedPrompt["funnelStage"])
    : "consideration";
}

function isPageFromDomain(url: string, domain: string) {
  const pageDomain = domainFromUrl(url);
  if (!pageDomain) return false;
  return pageDomain === domain || pageDomain.endsWith(`.${domain}`);
}

export async function ensureEngines(
  providers: AiEngineProvider[] = ENGINE_PROVIDERS,
  options: { searchEnabled?: boolean } = {},
) {
  return ensureEngineVariants(
    providers.map((provider) => ({
      provider,
      searchEnabled: options.searchEnabled,
    })),
  );
}

export type EngineSelection = {
  provider: AiEngineProvider;
  searchEnabled?: boolean;
};

export type PaidPlan = "starter" | "growth";
export type RecurringScanCadence = "weekly" | "daily";

export type BrandChatGptSummaryInput = {
  name: string;
  domain: string;
  description?: string | null;
  industry?: string | null;
  country: string;
  language: string;
};

type BrandChatGptInsightType =
  | "brandSummary"
  | "customerConcerns"
  | "productSummary";

export type BrandChatGptInsights = {
  brandSummary: string | null;
  customerConcernsSummary: string | null;
  productSummary: string | null;
};

export async function generateBrandChatGptSummary(
  input: BrandChatGptSummaryInput,
) {
  return generateBrandChatGptInsight(input, "brandSummary");
}

export async function generateBrandCustomerConcernsSummary(
  input: BrandChatGptSummaryInput,
) {
  return generateBrandChatGptInsight(input, "customerConcerns");
}

export async function generateBrandProductSummary(
  input: BrandChatGptSummaryInput,
) {
  return generateBrandChatGptInsight(input, "productSummary");
}

async function generateBrandChatGptInsight(
  input: BrandChatGptSummaryInput,
  insightType: BrandChatGptInsightType,
) {
  const domain = normalizeDomain(input.domain);
  const models = await aiModelSettings();
  const adapter = createAiAdapter("openai", {
    modelOverride: aiModelForProvider(models, "openai", true),
    searchEnabled: true,
  });
  const output = await adapter.runPrompt({
    prompt: buildBrandChatGptInsightPrompt({ ...input, domain }, insightType),
    language: input.language,
    country: input.country,
    brandName: input.name,
    brandDomain: domain,
    competitors: [],
    searchEnabled: true,
  });
  return normalizeBrandChatGptSummary(output.rawText);
}

export async function generateBrandChatGptSummarySafely(
  input: BrandChatGptSummaryInput,
) {
  return generateBrandChatGptInsightSafely(input, "brandSummary");
}

export async function generateBrandCustomerConcernsSummarySafely(
  input: BrandChatGptSummaryInput,
) {
  return generateBrandChatGptInsightSafely(input, "customerConcerns");
}

export async function generateBrandProductSummarySafely(
  input: BrandChatGptSummaryInput,
) {
  return generateBrandChatGptInsightSafely(input, "productSummary");
}

export async function generateBrandChatGptInsightsSafely(
  input: BrandChatGptSummaryInput,
): Promise<BrandChatGptInsights> {
  const [brandSummary, customerConcernsSummary, productSummary] =
    await Promise.all([
      generateBrandChatGptSummarySafely(input),
      generateBrandCustomerConcernsSummarySafely(input),
      generateBrandProductSummarySafely(input),
    ]);

  return {
    brandSummary,
    customerConcernsSummary,
    productSummary,
  };
}

async function generateBrandChatGptInsightSafely(
  input: BrandChatGptSummaryInput,
  insightType: BrandChatGptInsightType,
) {
  try {
    return await generateBrandChatGptInsight(input, insightType);
  } catch (error) {
    console.warn(`ChatGPT brand ${insightType} failed`, error);
    return null;
  }
}

const brandChatGptInsightPrompts: Record<
  BrandChatGptInsightType,
  {
    role: string;
    focus: string;
  }
> = {
  brandSummary: {
    role: "You are ChatGPT giving a first public impression of a brand for an AI visibility campaign.",
    focus:
      "Summarize what the brand appears to do, who it serves, and what it is known for. If the brand has little public information, say that clearly instead of inventing details.",
  },
  customerConcerns: {
    role: "You are ChatGPT researching public customer sentiment for an AI visibility campaign.",
    focus:
      "Focus on recurring public complaints, objections, weak points, limitations, or review themes from customers who are not satisfied with the brand. If reliable negative feedback is limited, say that clearly and do not speculate.",
  },
  productSummary: {
    role: "You are ChatGPT identifying a brand's core commercial offer for an AI visibility campaign.",
    focus:
      "Identify the most important products, services, categories, or offers the brand provides. Prioritize concrete product and service categories over marketing adjectives; if the offer is unclear, say that clearly.",
  },
};

function buildBrandChatGptInsightPrompt(
  input: BrandChatGptSummaryInput,
  insightType: BrandChatGptInsightType,
) {
  const insight = brandChatGptInsightPrompts[insightType];
  return [
    insight.role,
    "Use current public information when search is available. Prefer reliable public sources and the brand website.",
    insight.focus,
    "Write exactly three short sentences. No bullets, no headline, no markdown.",
    isSlovenianLanguage(input.language)
      ? "Write in natural Slovenian with correct č, š and ž."
      : `Write in ${input.language}.`,
    "",
    `Brand name: ${input.name}`,
    `Website: https://${input.domain}`,
    `Market: ${input.country}`,
    input.industry ? `Industry: ${input.industry}` : "",
    input.description ? `Known internal description: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeBrandChatGptSummary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const sentences =
    normalized
      .match(/[^.!?]+[.!?]+(?:["”])?/g)
      ?.map((sentence) => sentence.trim()) ?? [];
  const summary = (
    sentences.length ? sentences.slice(0, 3).join(" ") : normalized
  )
    .replace(/^["“]+|["”]+$/g, "")
    .trim();

  return summary.slice(0, 1200);
}

export async function ensureEngineVariants(selections: EngineSelection[]) {
  const modelSettings = await aiModelSettings();

  return Promise.all(
    uniqueEngineSelections(
      selections.length
        ? selections
        : ENGINE_PROVIDERS.map((provider) => ({ provider })),
    ).map(({ provider, searchEnabled }) => {
      const model =
        provider === "mock"
          ? "mock-ai-visibility-model"
          : aiModelForProvider(modelSettings, provider, searchEnabled);

      return prisma.engine.upsert({
        where: {
          provider_model_searchEnabled: {
            provider,
            model,
            searchEnabled,
          },
        },
        update: {
          engineName: engineName(provider, searchEnabled),
          isActive: true,
        },
        create: {
          provider,
          model,
          engineName: engineName(provider, searchEnabled),
          searchEnabled,
          isActive: true,
        },
      });
    }),
  );
}

export async function createScanForBrand(
  brandId: string,
  options: {
    triggerType?: "manual" | "free_audit" | "scheduled";
    promptLimit?: number;
    providers?: AiEngineProvider[];
    engineVariants?: EngineSelection[];
    repeatCount?: number;
    runNow?: boolean;
    searchEnabled?: boolean;
    initiatedByUserId?: string;
  } = {},
) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      promptSets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          prompts: { where: { isActive: true }, orderBy: { priority: "asc" } },
        },
      },
      organization: { include: { billingSubscription: true } },
    },
  });
  if (!brand) throw new Error("Brand not found");

  const triggerType = options.triggerType ?? "manual";
  if (triggerType === "manual") {
    if (!canRunManualScans(brand.organization)) {
      throw new Error(
        "Bad Request: ročni zagon scanov je vključen v paket Starter ali Growth.",
      );
    }
    const usage = await manualScanUsageForOrganization(
      brand.organizationId,
      brand.organization.plan,
    );
    if (usage.used >= usage.limit) {
      throw new Error(
        `Bad Request: ta paket omogoča največ ${usage.limit} ročnih scanov na mesec.`,
      );
    }
  }

  const promptSet = brand.promptSets[0];
  if (!promptSet || promptSet.prompts.length === 0) {
    throw new Error("Bad Request: za scan najprej vnesite uporabniške prompte");
  }
  const promptLimit = Math.min(
    options.promptLimit ?? MVP_LIMITS.promptCount,
    promptLimitForOrganization(brand.organization),
  );
  const prompts = promptSet.prompts.slice(0, promptLimit);
  const engines = options.engineVariants?.length
    ? await ensureEngineVariants(options.engineVariants)
    : await ensureEngines(options.providers ?? ENGINE_PROVIDERS, {
        searchEnabled: options.searchEnabled,
      });
  const repeatCount = options.repeatCount ?? MVP_LIMITS.repeatCount;
  const totalPromptRuns = prompts.length * engines.length * repeatCount;

  const scan = await prisma.scanRun.create({
    data: {
      brandId,
      promptSetId: promptSet.id,
      triggerType,
      status: "queued",
      totalPromptRuns,
      promptRuns: {
        create: prompts.flatMap((prompt) =>
          engines.flatMap((engine) =>
            Array.from({ length: repeatCount }, (_, repeatIndex) => ({
              promptId: prompt.id,
              engineId: engine.id,
              repeatIndex,
              status: "queued" as const,
            })),
          ),
        ),
      },
    },
    include: { promptRuns: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: brand.organizationId,
      userId: options.initiatedByUserId,
      action: "scan_started",
      entityType: "ScanRun",
      entityId: scan.id,
    },
  });

  if (options.runNow) {
    await runScanNow(scan.id);
  } else {
    await enqueueJob(JOB_NAMES.createScan, { scanRunId: scan.id }, scan.id);
  }

  return prisma.scanRun.findUnique({
    where: { id: scan.id },
    include: { promptRuns: true, scoreSnapshot: true },
  });
}

export function currentManualScanUsageWindow(from = new Date()) {
  const startAt = startOfMonth(from);
  const resetAt = new Date(startAt);
  resetAt.setMonth(resetAt.getMonth() + 1);
  return { startAt, resetAt };
}

export async function manualScanUsageForOrganization(
  organizationId: string,
  plan: Plan,
  from = new Date(),
) {
  const { startAt, resetAt } = currentManualScanUsageWindow(from);
  const limit = PLAN_LIMITS[plan].scansPerMonth;
  const used = await prisma.scanRun.count({
    where: {
      brand: { organizationId },
      triggerType: "manual",
      createdAt: {
        gte: startAt,
        lt: resetAt,
      },
    },
  });

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt,
  };
}

export async function reviewPromptContentForBrand(promptId: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      promptSet: {
        include: {
          brand: true,
        },
      },
    },
  });
  if (!prompt) throw new Error("Prompt not found");

  const brand = prompt.promptSet.brand;
  const domain = normalizeDomain(brand.domain);
  const searchQuery = `${prompt.text} site:${domain}`;
  if (!(await promptContentReviewStorageAvailable())) {
    throw new Error(
      "Bad Request: tabela PromptContentReview se ni ustvarjena; za bazo zazeni Prisma migracijo.",
    );
  }

  try {
    const review = await runPromptContentReviewWithOpenAi({
      prompt: prompt.text,
      searchQuery,
      brandName: brand.name,
      domain,
      country: brand.country,
      language: brand.language,
    });

    return prisma.promptContentReview.create({
      data: {
        brandId: brand.id,
        promptId: prompt.id,
        promptText: prompt.text,
        searchQuery,
        resultUrl: review.resultUrl,
        resultTitle: review.resultTitle,
        foundOwnedResult: review.foundOwnedResult,
        score: review.score,
        summary: review.summary,
        rankingReadiness: review.rankingReadiness,
        issuesJson: review.issues,
        recommendationsJson: review.recommendations,
        rawText: review.rawText,
        rawJson: JSON.parse(JSON.stringify(review.rawJson)),
        status: "completed",
      },
    });
  } catch (error) {
    return prisma.promptContentReview.create({
      data: {
        brandId: brand.id,
        promptId: prompt.id,
        promptText: prompt.text,
        searchQuery,
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown review error",
      },
    });
  }
}

export async function promptContentReviewStorageAvailable() {
  try {
    const result = await prisma.$queryRaw<Array<{ table_name: string | null }>>`
      SELECT to_regclass('public."PromptContentReview"')::text AS table_name
    `;
    return Boolean(result[0]?.table_name);
  } catch {
    return false;
  }
}

type PromptContentReviewInput = {
  prompt: string;
  searchQuery: string;
  brandName: string;
  domain: string;
  country: string;
  language: string;
};

type PromptContentReviewOutput = {
  foundOwnedResult: boolean;
  resultTitle: string | null;
  resultUrl: string | null;
  score: number;
  summary: string;
  rankingReadiness: string;
  issues: string[];
  recommendations: string[];
  rawText: string;
  rawJson: unknown;
};

async function runPromptContentReviewWithOpenAi(
  input: PromptContentReviewInput,
): Promise<PromptContentReviewOutput> {
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for prompt content review");
  }

  const models = await aiModelSettings();
  const model = aiModelForProvider(models, "openai", true);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildPromptContentReviewPrompt(input),
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
        },
      ],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
    }),
  });

  const rawJson = await response.json();
  if (!response.ok) {
    throw new Error(
      `OpenAI Responses API error ${response.status}: ${JSON.stringify(rawJson)}`,
    );
  }

  const rawText = extractOpenAiResponseText(rawJson);
  const parsed = parseJsonObject(rawText);
  return normalizePromptContentReviewOutput(
    parsed,
    rawText,
    rawJson,
    input.domain,
  );
}

function buildPromptContentReviewPrompt(input: PromptContentReviewInput) {
  return [
    "You evaluate whether a measured website already has content that can help ChatGPT recommend or cite it for a buyer prompt.",
    "Use web search. Treat the search as a Google-style query and use exactly this query:",
    input.searchQuery,
    "",
    "Take the first organic result from the measured domain. If no result from that domain exists, do not invent a URL.",
    "Open or inspect the result when available and judge the actual page content, not just the snippet.",
    "",
    `Measured brand: ${input.brandName}`,
    `Measured domain: ${input.domain}`,
    `Market: ${input.country}`,
    `Prompt language: ${input.language}`,
    `Buyer prompt: ${input.prompt}`,
    "",
    "Score from 1 to 10 for how ready the page is to rank or be cited in ChatGPT for this prompt.",
    "Use 1-3 for no result, irrelevant content, or very thin content; 4-6 for partial coverage; 7 for useful but incomplete content; 8-10 for strong, specific, citation-ready content.",
    "If the score is below 8, give concrete improvements for the page.",
    "Return only strict JSON. Do not wrap it in markdown.",
    "",
    `{
  "foundOwnedResult": boolean,
  "resultTitle": string | null,
  "resultUrl": string | null,
  "score": number,
  "summary": string,
  "rankingReadiness": string,
  "issues": string[],
  "improvements": string[]
}`,
  ].join("\n");
}

function normalizePromptContentReviewOutput(
  parsed: unknown,
  rawText: string,
  rawJson: unknown,
  domain: string,
): PromptContentReviewOutput {
  const record = isObjectRecord(parsed) ? parsed : {};
  const sources = extractOpenAiResponseSources(rawJson).filter((source) =>
    isPageFromDomain(source.url, domain),
  );
  const parsedResultUrl = optionalText(record.resultUrl);
  const resultUrl =
    parsedResultUrl && isPageFromDomain(parsedResultUrl, domain)
      ? parsedResultUrl
      : (sources[0]?.url ?? null);
  const resultTitle =
    optionalText(record.resultTitle) ?? sources[0]?.title ?? null;
  const foundOwnedResult = Boolean(resultUrl);
  const score = foundOwnedResult ? clampReviewScore(record.score) : 1;
  const issues = toStringArray(record.issues).slice(0, 8);
  const parsedRecommendations = toStringArray(record.improvements).slice(0, 8);
  const recommendations =
    parsedRecommendations.length || score >= 8
      ? parsedRecommendations
      : defaultPromptContentRecommendations(foundOwnedResult);

  return {
    foundOwnedResult,
    resultTitle,
    resultUrl,
    score,
    summary:
      optionalText(record.summary) ??
      (foundOwnedResult
        ? "Stran je bila najdena, vendar model ni vrnil povzetka."
        : "Za ta prompt na domeni ni bil najden primeren rezultat."),
    rankingReadiness:
      optionalText(record.rankingReadiness) ??
      (score >= 8
        ? "Vsebina je primerna za AI odgovore."
        : "Vsebina potrebuje izboljšave pred zanesljivim rangiranjem."),
    issues,
    recommendations,
    rawText,
    rawJson,
  };
}

function defaultPromptContentRecommendations(foundOwnedResult: boolean) {
  if (!foundOwnedResult) {
    return [
      "Dodaj namensko stran ali razdelek, ki neposredno odgovori na ta prompt.",
      "Vključi konkretne produkte ali storitve, primere uporabe, cene oziroma pogoje in dokazila.",
      "Poskrbi, da je stran indeksabilna in jasno povezana iz navigacije ali relevantnih kategorij.",
    ];
  }
  return [
    "Dopolni najdeno stran z neposrednim odgovorom na prompt že v uvodnem delu.",
    "Dodaj primerjave, konkretne podatke, FAQ in dokazila, ki jih lahko AI model povzame ali citira.",
    "Jasno poveži vsebino z znamko, ponudbo, lokacijo in nakupnim naslednjim korakom.",
  ];
}

function clampReviewScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(10, Math.max(1, Math.round(numeric)));
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractOpenAiResponseText(rawJson: any): string {
  if (typeof rawJson?.output_text === "string") return rawJson.output_text;
  const blocks: string[] = [];
  walkJson(rawJson, (value) => {
    if (!isObjectRecord(value)) return;
    if (
      (value.type === "output_text" || value.type === "text") &&
      typeof value.text === "string"
    ) {
      blocks.push(value.text);
    }
  });
  return blocks.join("\n").trim();
}

function extractOpenAiResponseSources(rawJson: unknown) {
  const sources: Array<{ url: string; title?: string | null }> = [];
  const seen = new Set<string>();
  walkJson(rawJson, (value) => {
    if (!isObjectRecord(value)) return;
    const url = optionalText(value.url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    sources.push({
      url,
      title: optionalText(value.title),
    });
  });
  return sources;
}

function walkJson(value: unknown, visitor: (value: unknown) => void) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visitor);
    return;
  }
  for (const item of Object.values(value)) walkJson(item, visitor);
}

export function recurringScanCadenceForPlan(
  plan: Plan,
): RecurringScanCadence | null {
  if (plan === "free" || plan === "starter" || plan === "growth")
    return "weekly";
  return null;
}

export function nextRecurringScanDate(
  cadence: RecurringScanCadence,
  from = new Date(),
) {
  const next = new Date(from);
  next.setDate(next.getDate() + (cadence === "daily" ? 1 : 7));
  return next;
}

export function defaultRecurringScanEngineVariants(): EngineSelection[] {
  return ENGINE_PROVIDERS.map((provider) => ({
    provider,
    searchEnabled: true,
  }));
}

export function recurringScanActivationData(plan: Plan, from = new Date()) {
  const cadence = recurringScanCadenceForPlan(plan);
  if (!cadence) return null;

  return {
    recurringScanActive: true,
    recurringScanCadence: cadence,
    recurringScanPlan: plan,
    recurringScanActivatedAt: from,
    recurringScanNextRunAt: from,
    recurringScanProviderVariants: defaultRecurringScanEngineVariants(),
  };
}

export async function activateRecurringScansForOrganizationPlan(
  organizationId: string,
  plan: Plan,
  from = new Date(),
) {
  const data = recurringScanActivationData(plan, from);
  if (!data) return { count: 0 };

  return prisma.brand.updateMany({
    where: { organizationId },
    data,
  });
}

export async function activateRecurringScansForPaidOrganization(
  organizationId: string,
  plan: PaidPlan,
  from = new Date(),
) {
  return activateRecurringScansForOrganizationPlan(organizationId, plan, from);
}

export async function activateRecurringScansForGrowthOrganization(
  organizationId: string,
  from = new Date(),
) {
  return activateRecurringScansForOrganizationPlan(
    organizationId,
    "growth",
    from,
  );
}

export async function deactivateRecurringScansForOrganization(
  organizationId: string,
) {
  return prisma.brand.updateMany({
    where: { organizationId },
    data: {
      recurringScanActive: false,
      recurringScanPlan: null,
      recurringScanCadence: null,
      recurringScanNextRunAt: null,
    },
  });
}

export function recurringScanEngineVariantsFromJson(
  value: unknown,
): EngineSelection[] {
  if (!Array.isArray(value)) return defaultRecurringScanEngineVariants();
  const variants: EngineSelection[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.provider === "openai" ||
        candidate.provider === "google" ||
        candidate.provider === "anthropic") &&
      typeof candidate.searchEnabled === "boolean"
    ) {
      variants.push({
        provider: candidate.provider,
        searchEnabled: candidate.searchEnabled,
      });
    }
  }

  return variants.length ? variants : defaultRecurringScanEngineVariants();
}

export async function activateRecurringScanForBrand(
  brandId: string,
  _plan: PaidPlan,
) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { organization: { include: { billingSubscription: true } } },
  });
  if (!brand) throw new Error("Brand not found");
  if (!canRunAutomaticScans(brand.organization)) {
    throw new Error("Bad Request: recurring scan is not available");
  }

  const cadence = recurringScanCadenceForPlan(brand.organization.plan);
  if (!cadence) throw new Error("Bad Request: recurring scan is not available");
  const now = new Date();
  const data = recurringScanActivationData(brand.organization.plan, now);
  if (!data) throw new Error("Bad Request: recurring scan is not available");

  return prisma.brand.update({
    where: { id: brandId },
    data,
  });
}

export async function deactivateRecurringScanForBrand(brandId: string) {
  return prisma.brand.update({
    where: { id: brandId },
    data: {
      recurringScanActive: false,
      recurringScanNextRunAt: null,
    },
  });
}

export async function runScanNow(scanRunId: string) {
  const slot = await tryStartScanRun(scanRunId);
  if (!slot.started) {
    return prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: { promptRuns: true, scoreSnapshot: true },
    });
  }

  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      brand: { include: { competitors: true } },
      promptRuns: {
        include: {
          prompt: true,
          engine: true,
          aiResponse: { include: { parsedResult: true } },
        },
      },
    },
  });
  if (!scan) throw new Error("Scan not found");
  if (scan.status === "canceled") return scan;

  await runPromptRunsInBatches(
    scanRunId,
    scan.promptRuns
      .filter((promptRun) => !promptRun.aiResponse)
      .map((promptRun) => promptRun.id),
  );

  if (await isScanCanceled(scanRunId)) {
    return prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: { promptRuns: true, scoreSnapshot: true },
    });
  }

  return scoreScan(scanRunId);
}

export async function runNextScanStep(scanRunId: string) {
  await resetStaleScanWork();

  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { scoreSnapshot: true },
  });
  if (!scan) throw new Error("Scan not found");
  if (
    scan.status === "completed" ||
    scan.status === "failed" ||
    scan.status === "canceled"
  ) {
    return scan;
  }

  const staleCutoff = new Date(Date.now() - 1000 * 60 * 2);
  await prisma.promptRun.updateMany({
    where: {
      scanRunId,
      status: "running",
      OR: [{ startedAt: null }, { startedAt: { lt: staleCutoff } }],
    },
    data: {
      status: "queued",
      startedAt: null,
      finishedAt: null,
      errorMessage: "Ponovni poskus po preteku časa izvajanja.",
    },
  });

  if (scan.status === "queued") {
    const slot = await tryStartScanRun(scanRunId);
    if (!slot.started) {
      return prisma.scanRun.findUnique({
        where: { id: scanRunId },
        include: { scoreSnapshot: true },
      });
    }
  }

  const activePromptRuns = await prisma.promptRun.count({
    where: { scanRunId, status: "running" },
  });
  const availablePromptSlots = Math.max(
    0,
    promptRunConcurrencyLimit() - activePromptRuns,
  );

  if (availablePromptSlots > 0) {
    const nextPromptRuns = await prisma.promptRun.findMany({
      where: { scanRunId, status: "queued" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: availablePromptSlots,
    });

    await Promise.allSettled(
      nextPromptRuns.map((promptRun) => runPromptRun(promptRun.id)),
    );
  }

  if (await isScanCanceled(scanRunId)) {
    return prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: { scoreSnapshot: true },
    });
  }

  const remainingPromptRuns = await prisma.promptRun.count({
    where: {
      scanRunId,
      status: { in: ["queued", "running"] },
    },
  });

  if (remainingPromptRuns === 0) {
    await scoreScan(scanRunId);
  }

  return prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { scoreSnapshot: true },
  });
}

async function runPromptRunsInBatches(
  scanRunId: string,
  promptRunIds: string[],
) {
  const concurrency = promptRunConcurrencyLimit();

  for (let index = 0; index < promptRunIds.length; index += concurrency) {
    if (await isScanCanceled(scanRunId)) return;
    const batch = promptRunIds.slice(index, index + concurrency);
    await Promise.allSettled(
      batch.map((promptRunId) => runPromptRun(promptRunId)),
    );
  }
}

export async function runPromptRun(promptRunId: string) {
  const promptRun = await prisma.promptRun.findUnique({
    where: { id: promptRunId },
    include: {
      prompt: true,
      engine: true,
      scanRun: {
        include: {
          brand: { include: { competitors: true } },
        },
      },
      aiResponse: true,
    },
  });
  if (!promptRun) throw new Error("Prompt run not found");
  if (promptRun.scanRun.status === "canceled") {
    await skipPromptRunIfPending(promptRunId, "Scan je bil preklican.");
    return null;
  }
  if (promptRun.aiResponse) return promptRun.aiResponse;
  if (promptRun.status !== "queued") {
    throw new Error(`Prompt run is already ${promptRun.status}`);
  }

  const claimed = await prisma.promptRun.updateMany({
    where: { id: promptRunId, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new Error("Prompt run is already being processed");
  }

  try {
    if (await isScanCanceled(promptRun.scanRunId)) {
      await skipPromptRunIfPending(promptRunId, "Scan je bil preklican.");
      return null;
    }
    const adapter = createAiAdapter(promptRun.engine.provider, {
      modelOverride: promptRun.engine.model.startsWith("env:")
        ? undefined
        : promptRun.engine.model,
      searchEnabled: promptRun.engine.searchEnabled,
    });
    const output = await withTimeout(
      adapter.runPrompt({
        prompt: promptRun.prompt.text,
        language: promptRun.scanRun.brand.language,
        country: promptRun.scanRun.brand.country,
        brandName: promptRun.scanRun.brand.name,
        brandDomain: promptRun.scanRun.brand.domain,
        competitors: promptRun.scanRun.brand.competitors.map((competitor) => ({
          name: competitor.name,
          domain: competitor.domain ?? undefined,
        })),
        searchEnabled: promptRun.engine.searchEnabled,
      }),
      PROMPT_EXECUTION_TIMEOUT_MS,
      `AI prompt run ${promptRunId}`,
    );
    if (await isScanCanceled(promptRun.scanRunId)) {
      await skipPromptRunIfPending(promptRunId, "Scan je bil preklican.");
      return null;
    }

    const aiResponse = await prisma.aiResponse.create({
      data: {
        promptRunId,
        provider: output.provider,
        model: output.model,
        rawText: output.rawText,
        rawJson: JSON.parse(JSON.stringify(output.rawJson)),
        citationsJson: output.citations,
        inputTokens: output.inputTokens,
        outputTokens: output.outputTokens,
        cost: output.cost,
        citations: {
          create: output.citations.map((citation) => ({
            url: citation.url,
            domain: citation.domain ?? normalizeDomain(citation.url),
            title: citation.title,
            sourceType: "provider",
          })),
        },
      },
    });

    await parseResponse(aiResponse.id);
    await prisma.promptRun.update({
      where: { id: promptRunId },
      data: { status: "completed", finishedAt: new Date() },
    });
    return aiResponse;
  } catch (error) {
    await prisma.promptRun.update({
      where: { id: promptRunId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Unknown provider error",
      },
    });
    throw error;
  }
}

export async function parseResponse(aiResponseId: string) {
  const aiResponse = await prisma.aiResponse.findUnique({
    where: { id: aiResponseId },
    include: {
      parsedResult: true,
      promptRun: {
        include: {
          prompt: true,
          scanRun: {
            include: {
              brand: { include: { competitors: true } },
            },
          },
        },
      },
    },
  });
  if (!aiResponse) throw new Error("AI response not found");
  if (aiResponse.parsedResult) return aiResponse.parsedResult;

  const config = getConfig();
  const parsed = await withTimeout(
    parseAiResponse({
      brandName: aiResponse.promptRun.scanRun.brand.name,
      brandDomain: aiResponse.promptRun.scanRun.brand.domain,
      brandAliases: toStringArray(aiResponse.promptRun.scanRun.brand.aliases),
      competitors: aiResponse.promptRun.scanRun.brand.competitors,
      knownBrandFacts: [
        aiResponse.promptRun.scanRun.brand.description ?? "",
        aiResponse.promptRun.scanRun.brand.industry ?? "",
      ].filter(Boolean),
      prompt: aiResponse.promptRun.prompt.text,
      rawAiAnswer: aiResponse.rawText,
      citations: toCitationArray(aiResponse.citationsJson),
      parserProvider: config.PARSER_PROVIDER,
      parserModel: config.PARSER_MODEL,
    }),
    PARSER_EXECUTION_TIMEOUT_MS,
    `AI response parser ${aiResponseId}`,
  );

  const result = await prisma.parsedResult.create({
    data: {
      aiResponseId,
      brandMentioned: parsed.brandMentioned,
      brandRank: parsed.brandRank,
      mentionCount: parsed.mentionCount,
      recommendationStrength: parsed.recommendationStrength,
      sentiment: parsed.sentiment,
      accuracyScore: parsed.accuracyScore,
      confidence: parsed.confidence,
      parsedJson: parsed,
    },
  });

  await prisma.citation.deleteMany({ where: { aiResponseId } });
  await prisma.citation.createMany({
    data: parsed.citations.map((citation) => ({
      aiResponseId,
      url: citation.url,
      domain: citation.domain,
      title: citation.title,
      isOwnedDomain: citation.isOwnedDomain,
      isCompetitorDomain: citation.isCompetitorDomain,
      supportsBrand: citation.supportsBrand,
      supportsCompetitor: citation.supportsCompetitor,
      sourceType: "provider",
    })),
  });

  await prisma.mention.createMany({
    data: [
      ...(parsed.brandMentioned
        ? [
            {
              aiResponseId,
              entityName: aiResponse.promptRun.scanRun.brand.name,
              entityType: "brand",
              rankPosition: parsed.brandRank,
              sentiment: parsed.sentiment,
              evidenceText: parsed.evidence.find(
                (item) => item.type === "brand_mention",
              )?.text,
              confidence: parsed.confidence,
            },
          ]
        : []),
      ...parsed.competitorsMentioned.map((competitor) => ({
        aiResponseId,
        entityName: competitor.name,
        entityType: "competitor",
        rankPosition: competitor.rank,
        sentiment: competitor.sentiment,
        evidenceText: competitor.evidenceText,
        confidence: parsed.confidence,
      })),
    ],
  });

  return result;
}

async function isScanCanceled(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    select: { status: true },
  });
  return scan?.status === "canceled";
}

async function skipPromptRunIfPending(
  promptRunId: string,
  errorMessage: string,
) {
  await prisma.promptRun.updateMany({
    where: {
      id: promptRunId,
      status: { in: ["queued", "running"] },
    },
    data: {
      status: "skipped",
      finishedAt: new Date(),
      errorMessage,
    },
  });
}

export async function scoreScan(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      brand: true,
      scoreSnapshot: true,
      promptRuns: {
        include: {
          prompt: true,
          engine: true,
          aiResponse: {
            include: {
              parsedResult: true,
            },
          },
        },
      },
    },
  });
  if (!scan) throw new Error("Scan not found");
  if (scan.status === "canceled") return scan.scoreSnapshot;

  const parsedResults = scan.promptRuns
    .map((promptRun) => {
      const parsed = promptRun.aiResponse?.parsedResult?.parsedJson as
        | ParsedAiResult
        | undefined;
      if (!parsed) return null;
      return {
        ...parsed,
        prompt: promptRun.prompt.text,
        engine: promptRun.engine.engineName,
      };
    })
    .filter(
      (result): result is ParsedAiResult & { prompt: string; engine: string } =>
        Boolean(result),
    );

  const score = calculateVisibilityScore(parsedResults);
  const scoreSnapshot = await prisma.scoreSnapshot.upsert({
    where: { scanRunId },
    update: score,
    create: {
      brandId: scan.brandId,
      scanRunId,
      ...score,
    },
  });

  await prisma.recommendation.deleteMany({
    where: { brandId: scan.brandId, scanRunId },
  });
  const recommendations = generateRecommendationDrafts(parsedResults);
  await prisma.recommendation.createMany({
    data: recommendations.map((recommendation) => ({
      brandId: scan.brandId,
      scanRunId,
      title: recommendation.title,
      description: recommendation.description,
      impactScore: recommendation.impactScore,
      effortScore: recommendation.effortScore,
      affectedPromptsJson: recommendation.affectedPromptsJson,
      affectedEnginesJson: recommendation.affectedEnginesJson,
    })),
  });

  const completedPromptRuns = scan.promptRuns.filter(
    (promptRun) => promptRun.status === "completed",
  ).length;
  const failedPromptRuns = scan.promptRuns.filter(
    (promptRun) => promptRun.status === "failed",
  ).length;
  const finalStatus =
    failedPromptRuns === scan.promptRuns.length ? "failed" : "completed";
  const finishedAt = new Date();

  const finalizedScan = await prisma.scanRun.updateMany({
    where: {
      id: scanRunId,
      status: { notIn: ["completed", "failed", "canceled"] },
    },
    data: {
      status: finalStatus,
      completedPromptRuns,
      failedPromptRuns,
      finishedAt,
    },
  });

  if (finalizedScan.count > 0) {
    await prisma.auditLog.create({
      data: {
        organizationId: scan.brand.organizationId,
        action: "scan_completed",
        entityType: "ScanRun",
        entityId: scanRunId,
      },
    });
  }

  if (finalStatus === "completed" && finalizedScan.count > 0) {
    await notifyScanCompleted(scanRunId);
  }

  return scoreSnapshot;
}

async function notifyScanCompleted(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      scoreSnapshot: true,
      brand: {
        include: {
          organization: {
            include: {
              memberships: {
                include: { user: true },
              },
            },
          },
        },
      },
      leads: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
    },
  });
  if (!scan?.scoreSnapshot) return;
  if (
    scan.triggerType !== "manual" &&
    scan.triggerType !== "scheduled" &&
    scan.triggerType !== "free_audit"
  )
    return;

  if (scan.triggerType === "free_audit") {
    await notifyFreeAuditScanCompleted(scan.leads);
    return;
  }

  const scoreSnapshot = scan.scoreSnapshot;
  const triggerType = scan.triggerType;
  const recipients = await scanCompletedNotificationRecipients(scan);
  if (recipients.length === 0) return;
  const results = await Promise.allSettled(
    recipients.map((recipient) => {
      const subject = scanCompletedEmailSubject({
        brandName: scan.brand.name,
        visibilityScore: scoreSnapshot.visibilityScore,
      });
      return sendAndRecordScanCompletedEmail({
        to: recipient.email,
        recipientName: recipient.name,
        brandName: scan.brand.name,
        brandDomain: scan.brand.domain,
        brandId: scan.brandId,
        scanRunId: scan.id,
        triggerType,
        visibilityScore: scoreSnapshot.visibilityScore,
        completedPromptRuns: scan.completedPromptRuns,
        failedPromptRuns: scan.failedPromptRuns,
        totalPromptRuns: scan.totalPromptRuns,
        finishedAt: scan.finishedAt,
        subject,
      });
    }),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn("Scan completion email failed", {
        scanRunId,
        email: recipients[index]?.email,
        error: result.reason,
      });
    }
  });
}

async function scanCompletedNotificationRecipients(scan: {
  id: string;
  triggerType: string;
  brand: {
    organizationId: string;
    organization: {
      memberships: Array<{
        role: string;
        user: { email: string; name: string | null };
      }>;
    };
  };
}) {
  if (scan.triggerType === "manual") {
    const startedBy = await prisma.auditLog.findFirst({
      where: {
        action: "scan_started",
        entityType: "ScanRun",
        entityId: scan.id,
        userId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        user: {
          select: {
            email: true,
            name: true,
            memberships: {
              where: { organizationId: scan.brand.organizationId },
              select: { id: true },
            },
          },
        },
      },
    });
    const user = startedBy?.user;
    if (!user || user.memberships.length === 0) return [];
    return uniqueNotificationRecipients([
      { email: user.email, name: user.name },
    ]);
  }

  return uniqueNotificationRecipients(
    scan.brand.organization.memberships
      .filter((membership) => membership.role === "owner")
      .map((membership) => membership.user),
  );
}

async function notifyFreeAuditScanCompleted(
  leads: Array<{ id: string; email: string; status: string }>,
) {
  const recipients = leads.filter((lead) => lead.status !== "report_sent");
  await Promise.allSettled(
    recipients.map((lead) => sendLeadAuditEmail(lead.id)),
  );
}

async function sendAndRecordScanCompletedEmail(input: {
  to: string;
  recipientName: string | null;
  brandName: string;
  brandDomain: string;
  brandId: string;
  scanRunId: string;
  triggerType: "manual" | "scheduled";
  visibilityScore: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
  totalPromptRuns: number;
  finishedAt: Date | null;
  subject: string;
}) {
  try {
    const email = await sendScanCompletedEmail(input);
    await recordScanEmailEvent({
      type: email.skipped ? "queued" : "sent",
      providerId: email.id,
      subject: input.subject,
    });
    return email;
  } catch (error) {
    await recordScanEmailEvent({
      type: "failed",
      subject: input.subject,
      error,
    });
    throw error;
  }
}

async function recordScanEmailEvent(input: {
  type: "queued" | "sent" | "failed";
  providerId?: string;
  subject: string;
  error?: unknown;
}) {
  try {
    await prisma.emailEvent.create({
      data: {
        type: input.type,
        provider: "resend",
        providerId: input.providerId,
        subject: input.subject,
        errorMessage: input.error ? errorMessage(input.error) : undefined,
      },
    });
  } catch (error) {
    console.warn("Scan email event logging failed", error);
  }
}

function scanCompletedEmailSubject(input: {
  brandName: string;
  visibilityScore: number;
}) {
  return `AI scan za ${input.brandName} je zaključen (${input.visibilityScore}/100)`;
}

export async function createFreeAudit(input: {
  email: string;
  domain: string;
  brandName: string;
  country: string;
  language: string;
  prompts: string[];
  providers?: AiEngineProvider[];
  competitors?: string;
  utmSource?: string;
  utmCampaign?: string;
}) {
  let auditStep = "organization";
  try {
    const organization = await prisma.organization.create({
      data: {
        name: input.brandName,
        plan: "free",
      },
    });
    auditStep = "brand";
    const chatGptInsights = await generateBrandChatGptInsightsSafely({
      name: input.brandName,
      domain: input.domain,
      country: input.country,
      language: input.language,
    });
    const brand = await prisma.brand.create({
      data: {
        organizationId: organization.id,
        name: input.brandName,
        domain: normalizeDomain(input.domain),
        country: input.country,
        language: input.language,
        aliases: [],
        chatGptBrandSummary: chatGptInsights.brandSummary,
        chatGptBrandSummaryUpdatedAt: chatGptInsights.brandSummary
          ? new Date()
          : undefined,
        chatGptCustomerConcernsSummary: chatGptInsights.customerConcernsSummary,
        chatGptCustomerConcernsSummaryUpdatedAt:
          chatGptInsights.customerConcernsSummary ? new Date() : undefined,
        chatGptProductSummary: chatGptInsights.productSummary,
        chatGptProductSummaryUpdatedAt: chatGptInsights.productSummary
          ? new Date()
          : undefined,
      },
    });
    const competitorNames = splitCompetitors(input.competitors);
    auditStep = "competitors";
    await prisma.competitor.createMany({
      data: competitorNames.map((name) => ({
        brandId: brand.id,
        name,
      })),
      skipDuplicates: true,
    });
    auditStep = "lead";
    const lead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        email: input.email,
        domain: brand.domain,
        brandName: input.brandName,
        source: "free_audit",
        utmSource: input.utmSource,
        utmCampaign: input.utmCampaign,
        leadScore: calculateLeadScore({
          email: input.email,
          competitorCount: competitorNames.length,
          crawledPageCount: 0,
        }),
      },
    });

    auditStep = "prompts";
    const promptSet = await createUserPromptSet(brand, input.prompts);
    auditStep = "scan";
    const scan = await createScanForBrand(brand.id, {
      triggerType: "free_audit",
      promptLimit: promptSet.prompts.length,
      providers: input.providers?.length ? input.providers : ["openai"],
      repeatCount: FREE_AUDIT_LIMITS.repeatCount,
      runNow: false,
      searchEnabled: false,
    });

    auditStep = "lead update";
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        auditScanRunId: scan?.id,
        leadScore: calculateLeadScore({
          email: input.email,
          competitorCount: competitorNames.length,
          crawledPageCount: 0,
          visibilityScore: scan?.scoreSnapshot?.visibilityScore,
        }),
      },
    });

    auditStep = "lead result";
    return prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        auditScanRun: {
          include: {
            scoreSnapshot: true,
            recommendations: true,
          },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Free audit failed at ${auditStep}: ${message}`);
  }
}

export async function sendLeadAuditEmail(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      auditScanRun: {
        include: {
          scoreSnapshot: true,
          recommendations: true,
          promptRuns: {
            include: {
              prompt: true,
              engine: true,
              aiResponse: { include: { parsedResult: true } },
            },
          },
        },
      },
    },
  });
  if (!lead?.auditScanRun?.scoreSnapshot)
    throw new Error("Audit result not ready");

  const topCompetitor = await topCompetitorForScan(lead.auditScanRun.id);
  const losingPrompts = lead.auditScanRun.promptRuns
    .filter((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as
        | ParsedAiResult
        | undefined;
      return parsed && (!parsed.brandMentioned || (parsed.brandRank ?? 99) > 3);
    })
    .map((run) => run.prompt.text)
    .slice(0, 3);
  const report = {
    domain: lead.domain,
    brandName: lead.brandName,
    score: lead.auditScanRun.scoreSnapshot,
    topCompetitor,
    losingPrompts,
    recommendations: lead.auditScanRun.recommendations,
    reportUrl: `${getConfig().NEXT_PUBLIC_APP_URL}/audit/${lead.id}`,
  };
  const email = await sendAuditReportEmail(lead.email, report);
  await prisma.emailEvent.create({
    data: {
      leadId,
      type: email.skipped ? "queued" : "sent",
      provider: "resend",
      providerId: email.id,
      subject: `Tvoj AI Visibility Score za ${lead.domain} je ${lead.auditScanRun.scoreSnapshot.visibilityScore}/100`,
    },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "report_sent" },
  });
  return email;
}

export async function buildAdminLeadDetail(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      auditScanRun: {
        include: {
          scoreSnapshot: true,
          recommendations: true,
          promptRuns: {
            include: {
              prompt: true,
              engine: true,
              aiResponse: { include: { parsedResult: true } },
            },
          },
        },
      },
    },
  });
  if (!lead?.auditScanRun?.scoreSnapshot) return { lead, salesBrief: null };
  const losingPrompts = lead.auditScanRun.promptRuns
    .filter((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as
        | ParsedAiResult
        | undefined;
      return parsed && (!parsed.brandMentioned || (parsed.brandRank ?? 99) > 3);
    })
    .map((run) => run.prompt.text)
    .slice(0, 3);
  const salesBrief = generateSalesBrief({
    domain: lead.domain,
    brandName: lead.brandName,
    score: lead.auditScanRun.scoreSnapshot,
    topCompetitor: await topCompetitorForScan(lead.auditScanRun.id),
    losingPrompts,
    recommendations: lead.auditScanRun.recommendations,
    reportUrl: `${getConfig().NEXT_PUBLIC_APP_URL}/audit/${lead.id}`,
  });
  return { lead, salesBrief };
}

export async function topCompetitorForScan(scanRunId: string) {
  const mentions = await prisma.mention.groupBy({
    by: ["entityName"],
    where: {
      entityType: "competitor",
      aiResponse: { promptRun: { scanRunId } },
    },
    _count: { entityName: true },
    orderBy: { _count: { entityName: "desc" } },
    take: 1,
  });
  return mentions[0]?.entityName;
}

function uniqueEngineSelections(
  selections: EngineSelection[],
): Array<Required<EngineSelection>> {
  const seen = new Set<string>();
  const unique: Array<Required<EngineSelection>> = [];

  for (const selection of selections) {
    const searchEnabled =
      selection.searchEnabled ?? selection.provider !== "mock";
    const key = `${selection.provider}:${searchEnabled}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ provider: selection.provider, searchEnabled });
  }

  return unique;
}

function engineName(provider: AiEngineProvider, searchEnabled = false) {
  switch (provider) {
    case "openai":
      return searchEnabled ? "ChatGPT + search" : "ChatGPT";
    case "google":
      return searchEnabled ? "Gemini + search" : "Gemini";
    case "anthropic":
      return searchEnabled ? "Claude + search" : "Claude";
    case "mock":
      return "Mock";
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toCitationArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === "object" && "url" in item)
        .map((item: any) => ({
          url: String(item.url),
          title: item.title ? String(item.title) : undefined,
          domain: item.domain ? String(item.domain) : undefined,
        }))
    : [];
}

function splitCompetitors(value?: string) {
  return (
    value
      ?.split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10) ?? []
  );
}

function uniqueNotificationRecipients(
  users: Array<{ email: string; name: string | null }>,
) {
  const seen = new Set<string>();
  const recipients: Array<{ email: string; name: string | null }> = [];

  for (const user of users) {
    const email = user.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email, name: user.name });
  }

  return recipients;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function positiveNumberFromEnv(
  name: string,
  fallback: number,
  minimum: number,
) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(parsed);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function startOfMonth(from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), 1);
}
