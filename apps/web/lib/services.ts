import { crawlDomain } from "@ai-radar/crawler";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { createAiAdapter } from "@ai-radar/ai";
import { parseAiResponse, parseJsonObject } from "@ai-radar/parser";
import {
  calculateLeadScore,
  calculateVisibilityScore,
  generateRecommendationDrafts
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
  type PromptCategory
} from "@ai-radar/shared";
import { sendAuditReportEmail } from "@ai-radar/email";
import { generateSalesBrief } from "@ai-radar/reports";
import { enqueueJob } from "@/lib/queue";

export async function crawlBrand(
  brandId: string,
  maxPages: number = MVP_LIMITS.maxPages,
  crawlOptions: { timeoutMs?: number; rateLimitMs?: number } = {}
) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error("Brand not found");
  const snapshot = await prisma.crawlSnapshot.create({
    data: {
      brandId,
      status: "running",
      maxPages
    }
  });
  const result = await crawlDomain({ domain: brand.domain, maxPages, ...crawlOptions });
  await prisma.crawlSnapshot.update({
    where: { id: snapshot.id },
    data: {
      status: result.failed ? "failed" : "completed",
      robotsTxt: result.robotsTxt,
      sitemapUrl: result.sitemapUrl,
      errorMessage: result.errorMessage,
      completedAt: new Date(),
      pages: {
        create: result.pages.map((page) => ({
          url: page.url,
          title: page.title,
          metaDescription: page.metaDescription,
          h1: page.h1,
          h2: page.h2,
          mainText: page.mainText,
          schemaJson: page.schemaJson === undefined ? undefined : JSON.parse(JSON.stringify(page.schemaJson)),
          statusCode: page.statusCode,
          canonicalUrl: page.canonicalUrl,
          discoveredAt: new Date(page.discoveredAt)
        }))
      }
    }
  });
  return prisma.crawlSnapshot.findUnique({
    where: { id: snapshot.id },
    include: { pages: true }
  });
}

export async function generatePromptsForBrand(brandId: string, count: number = MVP_LIMITS.promptCount) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      competitors: true,
      crawlSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { pages: true }
      }
    }
  });
  if (!brand) throw new Error("Brand not found");

  const brandDomain = normalizeDomain(brand.domain);
  const crawledPages = brand.crawlSnapshots[0]?.pages ?? [];
  const pages: CrawledPageSnapshot[] = crawledPages
    .map((page) => ({
      url: page.url,
      title: page.title ?? undefined,
      metaDescription: page.metaDescription ?? undefined,
      h1: page.h1 ?? undefined,
      h2: Array.isArray(page.h2) ? (page.h2 as string[]) : [],
      mainText: page.mainText ?? undefined,
      schemaJson: page.schemaJson,
      statusCode: page.statusCode,
      canonicalUrl: page.canonicalUrl ?? undefined,
      discoveredAt: page.discoveredAt.toISOString()
    }))
    .filter((page) => isPageFromDomain(page.url, brandDomain));

  const generated = await generatePromptSetWithChatGpt({
    brandName: brand.name,
    domain: brandDomain,
    country: brand.country,
    language: brand.language,
    competitors: brand.competitors,
    pages,
    count
  });

  await prisma.promptSet.updateMany({
    where: { brandId, status: "active" },
    data: { status: "archived" }
  });

  return prisma.promptSet.create({
    data: {
      brandId,
      name: `${brand.name} MVP prompts`,
      language: brand.language,
      country: brand.country,
      status: "active",
      prompts: {
        create: generated.map((prompt) => ({
          text: prompt.text,
          category: prompt.category,
          intent: prompt.intent,
          persona: prompt.persona,
          funnelStage: prompt.funnelStage,
          priority: prompt.priority,
          isActive: true
        }))
      }
    },
    include: { prompts: true }
  });
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  "category",
  "problem",
  "comparison",
  "best_for",
  "local",
  "branded",
  "competitor_alternative"
];

const FUNNEL_STAGES: GeneratedPrompt["funnelStage"][] = ["awareness", "consideration", "decision"];

async function generatePromptSetWithChatGpt(input: {
  brandName: string;
  domain: string;
  country: string;
  language: string;
  competitors: Array<{ name: string; domain?: string | null }>;
  pages: CrawledPageSnapshot[];
  count: number;
}): Promise<GeneratedPrompt[]> {
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for ChatGPT prompt generation");
  }

  const adapter = createAiAdapter("openai", {
    modelOverride: config.OPENAI_MODEL,
    searchEnabled: false
  });

  const output = await adapter.runPrompt({
    prompt: buildPromptGenerationPrompt(input),
    language: input.language,
    country: input.country,
    brandName: input.brandName,
    brandDomain: input.domain,
    competitors: input.competitors.map((competitor) => ({
      name: competitor.name,
      domain: competitor.domain ?? undefined
    })),
    searchEnabled: false
  });

  const parsed = parseJsonObject(output.rawText);
  const generated = normalizeChatGptPrompts(parsed, input);
  if (generated.length < input.count) {
    throw new Error(`ChatGPT returned ${generated.length} valid prompts, expected ${input.count}`);
  }
  return generated.slice(0, input.count);
}

function buildPromptGenerationPrompt(input: {
  brandName: string;
  domain: string;
  country: string;
  language: string;
  competitors: Array<{ name: string; domain?: string | null }>;
  pages: CrawledPageSnapshot[];
  count: number;
}) {
  return [
    "You generate AI visibility test prompts for one specific website.",
    "Return only strict JSON. Do not wrap it in markdown.",
    "",
    `Website under analysis: ${input.brandName} (${input.domain})`,
    `Target market: ${input.country}`,
    `Prompt language: ${input.language}`,
    `Known competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "none"}`,
    "",
    "Use only the website context below. Do not use SEOS, seos.si, AI Visibility Radar, or marketing/SEO topics unless they are clearly present in this website context.",
    "Create prompts that real buyers would ask ChatGPT, Gemini, or Claude when looking for a provider, product, service, alternative, comparison, or solution like this website.",
    "Most prompts should be discovery/comparison/problem prompts and should not mention the measured brand by name. Include at most two branded prompts.",
    `Generate exactly ${input.count} prompts.`,
    "",
    "Every prompt must be an object with:",
    `text: string, category: one of ${PROMPT_CATEGORIES.join(", ")}, intent: string, persona: string, funnelStage: one of ${FUNNEL_STAGES.join(", ")}`,
    "",
    "Return JSON in this exact shape:",
    `{"prompts":[{"text":"...","category":"category","intent":"...","persona":"...","funnelStage":"awareness"}]}`,
    "",
    "Website context:",
    JSON.stringify(buildWebsiteContext(input.pages), null, 2)
  ].join("\n");
}

function buildWebsiteContext(pages: CrawledPageSnapshot[]) {
  return pages.slice(0, 10).map((page) => ({
    url: page.url,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    h2: page.h2.slice(0, 8),
    textSample: page.mainText?.replace(/\s+/g, " ").trim().slice(0, 1200)
  }));
}

function normalizeChatGptPrompts(
  parsed: unknown,
  input: {
    country: string;
    language: string;
    count: number;
  }
): GeneratedPrompt[] {
  const value = parsed as { prompts?: unknown };
  const rawPrompts = Array.isArray(value.prompts) ? value.prompts : Array.isArray(parsed) ? parsed : [];

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
  }
): GeneratedPrompt | null {
  if (!item || typeof item !== "object") return null;
  const draft = item as Record<string, unknown>;
  const text = typeof draft.text === "string" ? draft.text.trim() : "";
  if (text.length < 8) return null;

  return {
    text,
    category: promptCategory(draft.category),
    intent: typeof draft.intent === "string" && draft.intent.trim() ? draft.intent.trim() : "buyer discovery",
    persona: typeof draft.persona === "string" && draft.persona.trim() ? draft.persona.trim() : "buyer",
    funnelStage: funnelStage(draft.funnelStage),
    priority: index + 1,
    language: input.language,
    country: input.country
  };
}

function promptCategory(value: unknown): PromptCategory {
  return PROMPT_CATEGORIES.includes(value as PromptCategory) ? (value as PromptCategory) : "category";
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
  options: { searchEnabled?: boolean } = {}
) {
  return ensureEngineVariants(
    providers.map((provider) => ({
      provider,
      searchEnabled: options.searchEnabled
    }))
  );
}

export type EngineSelection = {
  provider: AiEngineProvider;
  searchEnabled?: boolean;
};

export type PaidPlan = Exclude<Plan, "free">;
export type RecurringScanCadence = "weekly" | "daily";

export async function ensureEngineVariants(selections: EngineSelection[]) {
  const config = getConfig();
  const models: Record<AiEngineProvider, string | undefined> = {
    openai: config.OPENAI_MODEL,
    google: config.GEMINI_MODEL,
    anthropic: config.CLAUDE_MODEL,
    mock: "mock-ai-visibility-model"
  };

  return Promise.all(
    uniqueEngineSelections(selections.length ? selections : ENGINE_PROVIDERS.map((provider) => ({ provider }))).map(
      ({ provider, searchEnabled }) =>
        prisma.engine.upsert({
          where: {
            provider_model_searchEnabled: {
              provider,
              model: models[provider] ?? `env:${provider}`,
              searchEnabled
            }
          },
          update: {
            engineName: engineName(provider, searchEnabled),
            isActive: true
          },
          create: {
            provider,
            model: models[provider] ?? `env:${provider}`,
            engineName: engineName(provider, searchEnabled),
            searchEnabled,
            isActive: true
          }
        })
    )
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
  } = {}
) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      promptSets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { prompts: { where: { isActive: true }, orderBy: { priority: "asc" } } }
      }
    }
  });
  if (!brand) throw new Error("Brand not found");

  const promptSet =
    brand.promptSets[0] ?? (await generatePromptsForBrand(brandId, options.promptLimit ?? MVP_LIMITS.promptCount));
  const prompts = promptSet.prompts.slice(0, options.promptLimit ?? MVP_LIMITS.promptCount);
  const engines = options.engineVariants?.length
    ? await ensureEngineVariants(options.engineVariants)
    : await ensureEngines(options.providers ?? ENGINE_PROVIDERS, {
        searchEnabled: options.searchEnabled
      });
  const repeatCount = options.repeatCount ?? MVP_LIMITS.repeatCount;
  const totalPromptRuns = prompts.length * engines.length * repeatCount;

  const scan = await prisma.scanRun.create({
    data: {
      brandId,
      promptSetId: promptSet.id,
      triggerType: options.triggerType ?? "manual",
      status: "queued",
      totalPromptRuns,
      promptRuns: {
        create: prompts.flatMap((prompt) =>
          engines.flatMap((engine) =>
            Array.from({ length: repeatCount }, (_, repeatIndex) => ({
              promptId: prompt.id,
              engineId: engine.id,
              repeatIndex,
              status: "queued" as const
            }))
          )
        )
      }
    },
    include: { promptRuns: true }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: brand.organizationId,
      action: "scan_started",
      entityType: "ScanRun",
      entityId: scan.id
    }
  });

  if (options.runNow) {
    await runScanNow(scan.id);
  } else {
    await enqueueJob(JOB_NAMES.createScan, { scanRunId: scan.id }, scan.id);
  }

  return prisma.scanRun.findUnique({
    where: { id: scan.id },
    include: { promptRuns: true, scoreSnapshot: true }
  });
}

export function recurringScanCadenceForPlan(plan: Plan): RecurringScanCadence | null {
  if (plan === "growth") return "daily";
  if (plan === "starter") return "weekly";
  return null;
}

export function nextRecurringScanDate(cadence: RecurringScanCadence, from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + (cadence === "daily" ? 1 : 7));
  return next;
}

export function defaultRecurringScanEngineVariants(): EngineSelection[] {
  return [{ provider: "openai", searchEnabled: true }];
}

export function recurringScanEngineVariantsFromJson(value: unknown): EngineSelection[] {
  if (!Array.isArray(value)) return defaultRecurringScanEngineVariants();
  const variants: EngineSelection[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.provider === "openai" || candidate.provider === "google" || candidate.provider === "anthropic") &&
      typeof candidate.searchEnabled === "boolean"
    ) {
      variants.push({
        provider: candidate.provider,
        searchEnabled: candidate.searchEnabled
      });
    }
  }

  return variants.length ? variants : defaultRecurringScanEngineVariants();
}

export async function activateRecurringScanForBrand(brandId: string, plan: PaidPlan) {
  const cadence = recurringScanCadenceForPlan(plan);
  if (!cadence) throw new Error("Bad Request: recurring scan requires a paid plan");
  const now = new Date();

  return prisma.brand.update({
    where: { id: brandId },
    data: {
      recurringScanActive: true,
      recurringScanCadence: cadence,
      recurringScanPlan: plan,
      recurringScanActivatedAt: now,
      recurringScanNextRunAt: now,
      recurringScanProviderVariants: defaultRecurringScanEngineVariants()
    }
  });
}

export async function deactivateRecurringScanForBrand(brandId: string) {
  return prisma.brand.update({
    where: { id: brandId },
    data: {
      recurringScanActive: false,
      recurringScanNextRunAt: null
    }
  });
}

export async function runScanNow(scanRunId: string) {
  const scan = await prisma.scanRun.update({
    where: { id: scanRunId },
    data: {
      status: "running",
      startedAt: new Date()
    },
    include: {
      brand: { include: { competitors: true } },
      promptRuns: {
        include: {
          prompt: true,
          engine: true,
          aiResponse: { include: { parsedResult: true } }
        }
      }
    }
  });

  await Promise.allSettled(
    scan.promptRuns
      .filter((promptRun) => !promptRun.aiResponse)
      .map((promptRun) => runPromptRun(promptRun.id))
  );

  return scoreScan(scanRunId);
}

export async function runNextScanStep(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { scoreSnapshot: true }
  });
  if (!scan) throw new Error("Scan not found");
  if (scan.status === "completed" || scan.status === "failed" || scan.status === "canceled") {
    return scan;
  }

  const staleCutoff = new Date(Date.now() - 1000 * 60 * 2);
  await prisma.promptRun.updateMany({
    where: {
      scanRunId,
      status: "running",
      startedAt: { lt: staleCutoff }
    },
    data: {
      status: "queued",
      errorMessage: "Ponovni poskus po preteku časa izvajanja."
    }
  });

  if (scan.status === "queued") {
    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        status: "running",
        startedAt: scan.startedAt ?? new Date()
      }
    });
  }

  const nextPromptRun = await prisma.promptRun.findFirst({
    where: { scanRunId, status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (nextPromptRun) {
    await runPromptRun(nextPromptRun.id).catch(() => null);
  }

  const remainingPromptRuns = await prisma.promptRun.count({
    where: {
      scanRunId,
      status: { in: ["queued", "running"] }
    }
  });

  if (remainingPromptRuns === 0) {
    await scoreScan(scanRunId);
  }

  return prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { scoreSnapshot: true }
  });
}

export async function runPromptRun(promptRunId: string) {
  const promptRun = await prisma.promptRun.findUnique({
    where: { id: promptRunId },
    include: {
      prompt: true,
      engine: true,
      scanRun: {
        include: {
          brand: { include: { competitors: true } }
        }
      },
      aiResponse: true
    }
  });
  if (!promptRun) throw new Error("Prompt run not found");
  if (promptRun.aiResponse) return promptRun.aiResponse;

  await prisma.promptRun.update({
    where: { id: promptRunId },
    data: { status: "running", startedAt: new Date() }
  });

  try {
    const adapter = createAiAdapter(promptRun.engine.provider, {
      modelOverride: promptRun.engine.model.startsWith("env:") ? undefined : promptRun.engine.model,
      searchEnabled: promptRun.engine.searchEnabled
    });
    const output = await adapter.runPrompt({
      prompt: promptRun.prompt.text,
      language: promptRun.scanRun.brand.language,
      country: promptRun.scanRun.brand.country,
      brandName: promptRun.scanRun.brand.name,
      brandDomain: promptRun.scanRun.brand.domain,
      competitors: promptRun.scanRun.brand.competitors.map((competitor) => ({
        name: competitor.name,
        domain: competitor.domain ?? undefined
      })),
      searchEnabled: promptRun.engine.searchEnabled
    });

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
            sourceType: "provider"
          }))
        }
      }
    });

    await parseResponse(aiResponse.id);
    await prisma.promptRun.update({
      where: { id: promptRunId },
      data: { status: "completed", finishedAt: new Date() }
    });
    return aiResponse;
  } catch (error) {
    await prisma.promptRun.update({
      where: { id: promptRunId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown provider error"
      }
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
              brand: { include: { competitors: true } }
            }
          }
        }
      }
    }
  });
  if (!aiResponse) throw new Error("AI response not found");
  if (aiResponse.parsedResult) return aiResponse.parsedResult;

  const config = getConfig();
  const parsed = await parseAiResponse({
    brandName: aiResponse.promptRun.scanRun.brand.name,
    brandDomain: aiResponse.promptRun.scanRun.brand.domain,
    brandAliases: toStringArray(aiResponse.promptRun.scanRun.brand.aliases),
    competitors: aiResponse.promptRun.scanRun.brand.competitors,
    knownBrandFacts: [
      aiResponse.promptRun.scanRun.brand.description ?? "",
      aiResponse.promptRun.scanRun.brand.industry ?? ""
    ].filter(Boolean),
    prompt: aiResponse.promptRun.prompt.text,
    rawAiAnswer: aiResponse.rawText,
    citations: toCitationArray(aiResponse.citationsJson),
    parserProvider: config.PARSER_PROVIDER,
    parserModel: config.PARSER_MODEL
  });

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
      parsedJson: parsed
    }
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
      sourceType: "provider"
    }))
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
              evidenceText: parsed.evidence.find((item) => item.type === "brand_mention")?.text,
              confidence: parsed.confidence
            }
          ]
        : []),
      ...parsed.competitorsMentioned.map((competitor) => ({
        aiResponseId,
        entityName: competitor.name,
        entityType: "competitor",
        rankPosition: competitor.rank,
        sentiment: competitor.sentiment,
        evidenceText: competitor.evidenceText,
        confidence: parsed.confidence
      }))
    ]
  });

  return result;
}

export async function scoreScan(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      brand: true,
      promptRuns: {
        include: {
          prompt: true,
          engine: true,
          aiResponse: {
            include: {
              parsedResult: true
            }
          }
        }
      }
    }
  });
  if (!scan) throw new Error("Scan not found");

  const parsedResults = scan.promptRuns
    .map((promptRun) => {
      const parsed = promptRun.aiResponse?.parsedResult?.parsedJson as ParsedAiResult | undefined;
      if (!parsed) return null;
      return {
        ...parsed,
        prompt: promptRun.prompt.text,
        engine: promptRun.engine.engineName
      };
    })
    .filter((result): result is ParsedAiResult & { prompt: string; engine: string } => Boolean(result));

  const score = calculateVisibilityScore(parsedResults);
  const scoreSnapshot = await prisma.scoreSnapshot.upsert({
    where: { scanRunId },
    update: score,
    create: {
      brandId: scan.brandId,
      scanRunId,
      ...score
    }
  });

  await prisma.recommendation.deleteMany({
    where: { brandId: scan.brandId, scanRunId }
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
      affectedEnginesJson: recommendation.affectedEnginesJson
    }))
  });

  const completedPromptRuns = scan.promptRuns.filter((promptRun) => promptRun.status === "completed").length;
  const failedPromptRuns = scan.promptRuns.filter((promptRun) => promptRun.status === "failed").length;
  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: {
      status: failedPromptRuns === scan.promptRuns.length ? "failed" : "completed",
      completedPromptRuns,
      failedPromptRuns,
      finishedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: scan.brand.organizationId,
      action: "scan_completed",
      entityType: "ScanRun",
      entityId: scanRunId
    }
  });

  return scoreSnapshot;
}

export async function createFreeAudit(input: {
  email: string;
  domain: string;
  brandName: string;
  country: string;
  language: string;
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
      plan: "free"
    }
  });
  auditStep = "brand";
  const brand = await prisma.brand.create({
    data: {
      organizationId: organization.id,
      name: input.brandName,
      domain: normalizeDomain(input.domain),
      country: input.country,
      language: input.language,
      aliases: []
    }
  });
  const competitorNames = splitCompetitors(input.competitors);
  auditStep = "competitors";
  await prisma.competitor.createMany({
    data: competitorNames.map((name) => ({
      brandId: brand.id,
      name
    })),
    skipDuplicates: true
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
        crawledPageCount: 0
      })
    }
  });

  auditStep = "crawl";
  await crawlBrand(brand.id, FREE_AUDIT_LIMITS.maxPages, { timeoutMs: 2500, rateLimitMs: 100 }).catch(() => null);
  auditStep = "prompts";
  await generatePromptsForBrand(brand.id, FREE_AUDIT_LIMITS.promptCount);
  auditStep = "scan";
  const scan = await createScanForBrand(brand.id, {
    triggerType: "free_audit",
    promptLimit: FREE_AUDIT_LIMITS.promptCount,
    providers: input.providers?.length ? input.providers : ["openai"],
    repeatCount: FREE_AUDIT_LIMITS.repeatCount,
    runNow: true,
    searchEnabled: false
  });

  auditStep = "lead update";
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      auditScanRunId: scan?.id,
      leadScore: calculateLeadScore({
        email: input.email,
        competitorCount: competitorNames.length,
        crawledPageCount: await prisma.crawledPage.count({
          where: { crawlSnapshot: { brandId: brand.id } }
        }),
        visibilityScore: scan?.scoreSnapshot?.visibilityScore
      })
    }
  });

  auditStep = "lead result";
  return prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      auditScanRun: {
        include: {
          scoreSnapshot: true,
          recommendations: true
        }
      }
    }
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
              aiResponse: { include: { parsedResult: true } }
            }
          }
        }
      }
    }
  });
  if (!lead?.auditScanRun?.scoreSnapshot) throw new Error("Audit result not ready");

  const topCompetitor = await topCompetitorForScan(lead.auditScanRun.id);
  const losingPrompts = lead.auditScanRun.promptRuns
    .filter((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as ParsedAiResult | undefined;
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
    reportUrl: `${getConfig().NEXT_PUBLIC_APP_URL}/audit/${lead.id}`
  };
  const email = await sendAuditReportEmail(lead.email, report);
  await prisma.emailEvent.create({
    data: {
      leadId,
      type: email.skipped ? "queued" : "sent",
      provider: "resend",
      providerId: email.id,
      subject: `Tvoj AI Visibility Score za ${lead.domain} je ${lead.auditScanRun.scoreSnapshot.visibilityScore}/100`
    }
  });
  await prisma.lead.update({ where: { id: leadId }, data: { status: "report_sent" } });
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
              aiResponse: { include: { parsedResult: true } }
            }
          }
        }
      }
    }
  });
  if (!lead?.auditScanRun?.scoreSnapshot) return { lead, salesBrief: null };
  const losingPrompts = lead.auditScanRun.promptRuns
    .filter((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as ParsedAiResult | undefined;
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
    reportUrl: `${getConfig().NEXT_PUBLIC_APP_URL}/audit/${lead.id}`
  });
  return { lead, salesBrief };
}

export async function topCompetitorForScan(scanRunId: string) {
  const mentions = await prisma.mention.groupBy({
    by: ["entityName"],
    where: {
      entityType: "competitor",
      aiResponse: { promptRun: { scanRunId } }
    },
    _count: { entityName: true },
    orderBy: { _count: { entityName: "desc" } },
    take: 1
  });
  return mentions[0]?.entityName;
}

function uniqueEngineSelections(selections: EngineSelection[]): Array<Required<EngineSelection>> {
  const seen = new Set<string>();
  const unique: Array<Required<EngineSelection>> = [];

  for (const selection of selections) {
    const searchEnabled = selection.searchEnabled ?? selection.provider !== "mock";
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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toCitationArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === "object" && "url" in item)
        .map((item: any) => ({
          url: String(item.url),
          title: item.title ? String(item.title) : undefined,
          domain: item.domain ? String(item.domain) : undefined
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
