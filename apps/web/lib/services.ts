import { crawlDomain } from "@ai-radar/crawler";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { createAiAdapter } from "@ai-radar/ai";
import { parseAiResponse } from "@ai-radar/parser";
import { generatePromptSet } from "@ai-radar/prompts";
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
  normalizeDomain,
  type AiEngineProvider,
  type CrawledPageSnapshot,
  type ParsedAiResult,
  type ScoreInputResult
} from "@ai-radar/shared";
import { sendAuditReportEmail } from "@ai-radar/email";
import { generateSalesBrief } from "@ai-radar/reports";
import { enqueueJob } from "@/lib/queue";

export async function crawlBrand(brandId: string, maxPages: number = MVP_LIMITS.maxPages) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error("Brand not found");
  const snapshot = await prisma.crawlSnapshot.create({
    data: {
      brandId,
      status: "running",
      maxPages
    }
  });
  const result = await crawlDomain({ domain: brand.domain, maxPages });
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

  const pages: CrawledPageSnapshot[] =
    brand.crawlSnapshots[0]?.pages.map((page) => ({
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
    })) ?? [];

  const generated = generatePromptSet({
    brandName: brand.name,
    domain: brand.domain,
    industry: brand.industry,
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

export async function ensureEngines(providers: AiEngineProvider[] = [...ENGINE_PROVIDERS, "mock"]) {
  const config = getConfig();
  const models: Record<AiEngineProvider, string | undefined> = {
    openai: config.OPENAI_MODEL,
    google: config.GEMINI_MODEL,
    anthropic: config.CLAUDE_MODEL,
    mock: "mock-ai-visibility-model"
  };

  return Promise.all(
    providers.map((provider) =>
      prisma.engine.upsert({
        where: {
          provider_model_searchEnabled: {
            provider,
            model: models[provider] ?? `env:${provider}`,
            searchEnabled: provider !== "mock"
          }
        },
        update: {
          engineName: engineName(provider),
          isActive: true
        },
        create: {
          provider,
          engineName: engineName(provider),
          model: models[provider] ?? `env:${provider}`,
          searchEnabled: provider !== "mock",
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
    repeatCount?: number;
    runNow?: boolean;
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
  const engines = await ensureEngines(options.providers ?? ENGINE_PROVIDERS);
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

  for (const promptRun of scan.promptRuns) {
    if (promptRun.aiResponse) continue;
    await runPromptRun(promptRun.id);
  }

  return scoreScan(scanRunId);
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
    .filter((result): result is ScoreInputResult & { prompt: string; engine: string } => Boolean(result));

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
  competitors?: string;
  utmSource?: string;
  utmCampaign?: string;
}) {
  const organization = await prisma.organization.create({
    data: {
      name: input.brandName,
      plan: "free"
    }
  });
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
  await prisma.competitor.createMany({
    data: competitorNames.map((name) => ({
      brandId: brand.id,
      name
    })),
    skipDuplicates: true
  });
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

  await crawlBrand(brand.id, FREE_AUDIT_LIMITS.maxPages).catch(() => null);
  await generatePromptsForBrand(brand.id, FREE_AUDIT_LIMITS.promptCount);
  const scan = await createScanForBrand(brand.id, {
    triggerType: "free_audit",
    promptLimit: FREE_AUDIT_LIMITS.promptCount,
    providers: ["mock"],
    repeatCount: FREE_AUDIT_LIMITS.repeatCount,
    runNow: true
  });

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

function engineName(provider: AiEngineProvider) {
  switch (provider) {
    case "openai":
      return "ChatGPT";
    case "google":
      return "Gemini";
    case "anthropic":
      return "Claude";
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
