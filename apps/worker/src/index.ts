import { Worker } from "bullmq";
import IORedis from "ioredis";
import { createAiAdapter } from "@ai-radar/ai";
import { getConfig } from "@ai-radar/config";
import { crawlDomain } from "@ai-radar/crawler";
import {
  prisma,
  promptRunConcurrencyLimit,
  scanConcurrencyLimit,
  tryStartScanRun,
} from "@ai-radar/db";
import { sendAuditReportEmail, sendScanCompletedEmail } from "@ai-radar/email";
import { parseAiResponse } from "@ai-radar/parser";
import { generatePromptSet } from "@ai-radar/prompts";
import { generateSalesBrief } from "@ai-radar/reports";
import {
  calculateLeadScore,
  calculateVisibilityScore,
  generateRecommendationDrafts,
} from "@ai-radar/scoring";
import {
  JOB_NAMES,
  normalizeDomain,
  type CrawledPageSnapshot,
  type ParsedAiResult,
  type ScoreInputResult,
} from "@ai-radar/shared";

const config = getConfig();
if (!config.REDIS_URL) {
  throw new Error("REDIS_URL is required for the worker process");
}
const PROMPT_EXECUTION_TIMEOUT_MS = positiveNumber(
  process.env.PROMPT_EXECUTION_TIMEOUT_MS,
  45_000,
  10_000,
);
const PARSER_EXECUTION_TIMEOUT_MS = positiveNumber(
  process.env.PARSER_EXECUTION_TIMEOUT_MS,
  20_000,
  5_000,
);
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "ai-visibility-radar",
  async (job) => {
    switch (job.name) {
      case JOB_NAMES.crawlDomain:
        return processCrawlDomain(job.data.brandId, job.data.maxPages ?? 50);
      case JOB_NAMES.generatePrompts:
        return processGeneratePrompts(job.data.brandId, job.data.count ?? 25);
      case JOB_NAMES.createScan:
        return processCreateScan(job.data.scanRunId);
      case JOB_NAMES.runPrompt:
        return processRunPrompt(job.data.promptRunId);
      case JOB_NAMES.parseResponse:
        return processParseResponse(job.data.aiResponseId);
      case JOB_NAMES.scoreScan:
        return processScoreScan(job.data.scanRunId);
      case JOB_NAMES.generateRecommendations:
        return processGenerateRecommendations(job.data.scanRunId);
      case JOB_NAMES.sendEmailReport:
        return processSendEmailReport(job.data.leadId);
      case JOB_NAMES.syncLeadToAdmin:
        return processSyncLead(job.data.leadId);
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: scanConcurrencyLimit(),
  },
);

worker.on("completed", (job) => {
  console.log(`Completed ${job.name} ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Failed ${job?.name} ${job?.id}`, error);
});

async function processCrawlDomain(brandId: string, maxPages: number) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error("Brand not found");
  const existingRunning = await prisma.crawlSnapshot.findFirst({
    where: { brandId, status: "running" },
    orderBy: { createdAt: "desc" },
  });
  const snapshot =
    existingRunning ??
    (await prisma.crawlSnapshot.create({
      data: {
        brandId,
        status: "running",
        maxPages,
      },
    }));
  const result = await crawlDomain({ domain: brand.domain, maxPages });
  await prisma.crawledPage.deleteMany({
    where: { crawlSnapshotId: snapshot.id },
  });
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
          schemaJson:
            page.schemaJson === undefined
              ? undefined
              : JSON.parse(JSON.stringify(page.schemaJson)),
          statusCode: page.statusCode,
          canonicalUrl: page.canonicalUrl,
          discoveredAt: new Date(page.discoveredAt),
        })),
      },
    },
  });
  return { snapshotId: snapshot.id, pages: result.pages.length };
}

async function processGeneratePrompts(brandId: string, count: number) {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      competitors: true,
      crawlSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { pages: true },
      },
    },
  });
  if (!brand) throw new Error("Brand not found");
  const existing = await prisma.promptSet.findFirst({
    where: { brandId, status: "active" },
    include: { prompts: true },
  });
  if (existing && existing.prompts.length >= count) return existing;

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
      discoveredAt: page.discoveredAt.toISOString(),
    })) ?? [];
  const generated = generatePromptSet({
    brandName: brand.name,
    domain: brand.domain,
    industry: brand.industry,
    country: brand.country,
    language: brand.language,
    competitors: brand.competitors,
    pages,
    count,
  });
  await prisma.promptSet.updateMany({
    where: { brandId, status: "active" },
    data: { status: "archived" },
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
        })),
      },
    },
  });
}

async function processCreateScan(scanRunId: string) {
  const slot = await waitForScanSlot(scanRunId);
  if (!slot.started) return { scanRunId, skipped: slot.reason };

  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: { promptRuns: true },
  });
  if (!scan) throw new Error("Scan not found");
  if (scan.status === "canceled") return { scanRunId, skipped: "canceled" };

  await processPromptRunsInBatches(
    scanRunId,
    scan.promptRuns.map((promptRun) => promptRun.id),
  );
  if (await isScanCanceled(scanRunId)) {
    return { scanRunId, skipped: "canceled" };
  }
  await processScoreScan(scanRunId);
  if (await isScanCanceled(scanRunId)) {
    return { scanRunId, skipped: "canceled" };
  }
  await processGenerateRecommendations(scanRunId);
  return { scanRunId };
}

async function processPromptRunsInBatches(
  scanRunId: string,
  promptRunIds: string[],
) {
  const concurrency = promptRunConcurrencyLimit();

  for (let index = 0; index < promptRunIds.length; index += concurrency) {
    if (await isScanCanceled(scanRunId)) return;
    const batch = promptRunIds.slice(index, index + concurrency);
    await Promise.allSettled(
      batch.map((promptRunId) => processRunPrompt(promptRunId)),
    );
  }
}

async function waitForScanSlot(scanRunId: string) {
  const timeoutMs = positiveNumber(
    process.env.SCAN_SLOT_WAIT_MS,
    30 * 60 * 1000,
  );
  const retryMs = positiveNumber(process.env.SCAN_SLOT_RETRY_MS, 15 * 1000);
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const slot = await tryStartScanRun(scanRunId);
    if (slot.started || slot.reason === "terminal") return slot;
    if (Date.now() + retryMs > deadline) {
      throw new Error(
        `Scan concurrency limit reached (${slot.runningCount}/${slot.limit}) for ${scanRunId}`,
      );
    }
    await sleep(retryMs);
  }
}

function positiveNumber(
  value: string | undefined,
  fallback: number,
  minimum = 1,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processRunPrompt(promptRunId: string) {
  const promptRun = await prisma.promptRun.findUnique({
    where: { id: promptRunId },
    include: {
      prompt: true,
      engine: true,
      aiResponse: true,
      scanRun: {
        include: {
          brand: {
            include: { competitors: true },
          },
        },
      },
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
      },
    });
    await processParseResponse(aiResponse.id);
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

async function processParseResponse(aiResponseId: string) {
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

async function processScoreScan(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
      brand: true,
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
  if (scan.status === "canceled") return null;
  const results = parsedResultsForScan(scan.promptRuns);
  const score = calculateVisibilityScore(results);
  const snapshot = await prisma.scoreSnapshot.upsert({
    where: { scanRunId },
    update: score,
    create: { brandId: scan.brandId, scanRunId, ...score },
  });
  const completedPromptRuns = scan.promptRuns.filter(
    (run) => run.status === "completed",
  ).length;
  const failedPromptRuns = scan.promptRuns.filter(
    (run) => run.status === "failed",
  ).length;
  const finalStatus = completedPromptRuns > 0 ? "completed" : "failed";
  const shouldNotifyScanCompleted =
    finalStatus === "completed" &&
    scan.status !== "completed" &&
    scan.triggerType !== "free_audit";

  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: {
      status: finalStatus,
      completedPromptRuns,
      failedPromptRuns,
      finishedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: scan.brand.organizationId,
      action: "scan_completed",
      entityType: "ScanRun",
      entityId: scanRunId,
    },
  });
  if (shouldNotifyScanCompleted) {
    await notifyScanCompleted(scanRunId);
  }
  return snapshot;
}

async function processGenerateRecommendations(scanRunId: string) {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    include: {
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
  if (scan.status === "canceled") return { count: 0, skipped: "canceled" };
  const drafts = generateRecommendationDrafts(
    parsedResultsForScan(scan.promptRuns),
  );
  await prisma.recommendation.deleteMany({ where: { scanRunId } });
  await prisma.recommendation.createMany({
    data: drafts.map((draft) => ({
      brandId: scan.brandId,
      scanRunId,
      title: draft.title,
      description: draft.description,
      impactScore: draft.impactScore,
      effortScore: draft.effortScore,
      affectedPromptsJson: draft.affectedPromptsJson,
      affectedEnginesJson: draft.affectedEnginesJson,
    })),
  });
  return { count: drafts.length };
}

async function processSendEmailReport(leadId: string) {
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
  const losingPrompts = lead.auditScanRun.promptRuns
    .filter((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as
        | ParsedAiResult
        | undefined;
      return parsed && (!parsed.brandMentioned || (parsed.brandRank ?? 99) > 3);
    })
    .map((run) => run.prompt.text);
  const report = {
    domain: lead.domain,
    brandName: lead.brandName,
    score: lead.auditScanRun.scoreSnapshot,
    topCompetitor: await topCompetitorForScan(lead.auditScanRun.id),
    losingPrompts,
    recommendations: lead.auditScanRun.recommendations,
    reportUrl: `${config.NEXT_PUBLIC_APP_URL}/audit/${lead.id}`,
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
  return email;
}

async function processSyncLead(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      auditScanRun: {
        include: {
          scoreSnapshot: true,
          promptRuns: {
            include: { aiResponse: { include: { mentions: true } } },
          },
        },
      },
    },
  });
  if (!lead) throw new Error("Lead not found");
  const competitorMentions =
    lead.auditScanRun?.promptRuns.flatMap(
      (run) =>
        run.aiResponse?.mentions.filter(
          (mention) => mention.entityType === "competitor",
        ) ?? [],
    ) ?? [];
  const brandMentions =
    lead.auditScanRun?.promptRuns.flatMap(
      (run) =>
        run.aiResponse?.mentions.filter(
          (mention) => mention.entityType === "brand",
        ) ?? [],
    ) ?? [];
  const leadScore = calculateLeadScore({
    email: lead.email,
    competitorCount: competitorMentions.length,
    crawledPageCount: 0,
    visibilityScore: lead.auditScanRun?.scoreSnapshot?.visibilityScore,
    competitorHasDoubleMentions:
      competitorMentions.length > brandMentions.length * 2,
    openedReport: lead.status === "opened",
    clickedDemo: lead.status === "demo_clicked",
  });
  await prisma.lead.update({ where: { id: leadId }, data: { leadScore } });
  return {
    salesBrief:
      lead.auditScanRun?.scoreSnapshot &&
      generateSalesBrief({
        domain: lead.domain,
        brandName: lead.brandName,
        score: lead.auditScanRun.scoreSnapshot,
        topCompetitor: await topCompetitorForScan(lead.auditScanRun.id),
        losingPrompts: [],
        recommendations: [],
        reportUrl: `${config.NEXT_PUBLIC_APP_URL}/audit/${lead.id}`,
      }),
  };
}

async function topCompetitorForScan(scanRunId: string) {
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
    },
  });
  if (!scan?.scoreSnapshot) return;
  if (scan.triggerType !== "manual" && scan.triggerType !== "scheduled") return;

  const scoreSnapshot = scan.scoreSnapshot;
  const triggerType = scan.triggerType;
  const recipients = uniqueNotificationRecipients(
    scan.brand.organization.memberships.map((membership) => membership.user),
  );
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

function parsedResultsForScan(promptRuns: Array<any>) {
  return promptRuns
    .map((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as
        | ParsedAiResult
        | undefined;
      if (!parsed) return null;
      return {
        ...parsed,
        prompt: run.prompt.text,
        engine: run.engine.engineName,
      };
    })
    .filter(
      (
        result,
      ): result is ScoreInputResult & { prompt: string; engine: string } =>
        Boolean(result),
    );
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
          domain: item.domain
            ? String(item.domain)
            : normalizeDomain(String(item.url)),
        }))
    : [];
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
