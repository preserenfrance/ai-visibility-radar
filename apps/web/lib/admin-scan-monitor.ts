import {
  prisma,
  promptRunStaleMs,
  scanRunStaleMs,
  type EngineProvider,
  type PromptRunStatus,
  type ScanRunStatus,
  type TriggerType,
} from "@ai-radar/db";
import { SCAN_QUEUE_TRIGGER_TYPES } from "@/lib/scan-queue";

const ACTIVE_SCAN_STATUSES: ScanRunStatus[] = ["queued", "running"];
const TERMINAL_SCAN_STATUSES: ScanRunStatus[] = [
  "completed",
  "failed",
  "canceled",
];
const PROMPT_STATUSES: PromptRunStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "skipped",
];
const PROVIDERS: EngineProvider[] = ["openai", "google", "anthropic", "mock"];

export type AdminScanMonitorSnapshot = {
  generatedAt: string;
  window: {
    lastHourStart: string;
    lastDayStart: string;
  };
  health: {
    queuedScans: number;
    runningScans: number;
    completedScans24h: number;
    failedScans24h: number;
    canceledScans24h: number;
    staleRunningScans: number;
    staleRunningPromptRuns: number;
    oldestQueuedAgeMs: number | null;
    oldestRunningAgeMs: number | null;
    averageCompletedScanDurationMs24h: number | null;
    emailFailures24h: number;
  };
  triggerTypes: Array<{
    triggerType: TriggerType;
    queued: number;
    running: number;
  }>;
  providers: AdminProviderSummary[];
  activeScans: AdminScanMonitorScan[];
  recentScans: AdminScanMonitorScan[];
  recentErrors: AdminPromptRunError[];
};

export type AdminProviderSummary = {
  provider: EngineProvider;
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  skipped: number;
  averageDurationMs: number | null;
  latestError: string | null;
};

export type AdminScanMonitorScan = {
  id: string;
  brandId: string;
  brandName: string;
  brandDomain: string;
  organizationName: string;
  organizationPlan: string;
  status: ScanRunStatus;
  triggerType: TriggerType;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  durationMs: number | null;
  ageMs: number;
  totalPromptRuns: number;
  promptCounts: Record<PromptRunStatus, number>;
  progressPercent: number;
  score: number | null;
  brandMentions: number;
  latestActivityAt: string | null;
  oldestRunningPromptStartedAt: string | null;
  averagePromptDurationMs: number | null;
  latestError: string | null;
  providers: AdminProviderSummary[];
};

export type AdminPromptRunError = {
  id: string;
  scanRunId: string;
  brandId: string;
  brandName: string;
  promptText: string;
  provider: EngineProvider;
  engineName: string;
  model: string;
  status: PromptRunStatus;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type PromptRunRecord = {
  id: string;
  status: PromptRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
  errorMessage: string | null;
  engine: {
    provider: EngineProvider;
    engineName: string;
    model: string;
    searchEnabled: boolean;
  };
  aiResponse?: {
    parsedResult: {
      brandMentioned: boolean;
      brandRank: number | null;
      mentionCount: number;
      sentiment: string;
      confidence: number;
    } | null;
  } | null;
};

type ScanRecord = {
  id: string;
  brandId: string;
  status: ScanRunStatus;
  triggerType: TriggerType;
  totalPromptRuns: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
  brand: {
    id: string;
    name: string;
    domain: string;
    organization: {
      name: string;
      plan: string;
    };
  };
  scoreSnapshot: {
    visibilityScore: number;
  } | null;
  promptRuns: PromptRunRecord[];
};

type ProviderPromptRunRecord = PromptRunRecord & {
  scanRun: {
    brand: {
      name: string;
    };
  };
};

export async function buildAdminScanMonitorSnapshot(): Promise<AdminScanMonitorSnapshot> {
  const now = new Date();
  const lastHourStart = addHours(now, -1);
  const lastDayStart = addDays(now, -1);
  const staleScanCutoff = new Date(now.getTime() - scanRunStaleMs());
  const stalePromptCutoff = new Date(now.getTime() - promptRunStaleMs());

  const [
    currentScanStatusGroups,
    lastDayScanStatusGroups,
    activeScans,
    recentScans,
    providerPromptRuns,
    recentErrors,
    staleRunningScans,
    staleRunningPromptRuns,
    emailFailures24h,
  ] = await Promise.all([
    prisma.scanRun.groupBy({
      by: ["status"],
      where: {
        triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
        status: { in: ACTIVE_SCAN_STATUSES },
      },
      _count: { _all: true },
    }),
    prisma.scanRun.groupBy({
      by: ["status"],
      where: {
        triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
        OR: [
          { createdAt: { gte: lastDayStart } },
          { finishedAt: { gte: lastDayStart } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.scanRun.findMany({
      where: {
        triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
        status: { in: ACTIVE_SCAN_STATUSES },
      },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
      take: 50,
      include: scanMonitorInclude(),
    }),
    prisma.scanRun.findMany({
      where: {
        triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
        status: { in: TERMINAL_SCAN_STATUSES },
        OR: [
          { finishedAt: { gte: lastDayStart } },
          { createdAt: { gte: lastDayStart } },
        ],
      },
      orderBy: [{ finishedAt: "desc" }, { updatedAt: "desc" }],
      take: 30,
      include: scanMonitorInclude(),
    }),
    prisma.promptRun.findMany({
      where: {
        scanRun: {
          triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
          OR: [
            { createdAt: { gte: lastDayStart } },
            { finishedAt: { gte: lastDayStart } },
            { updatedAt: { gte: lastDayStart } },
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 2500,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        updatedAt: true,
        errorMessage: true,
        engine: {
          select: {
            provider: true,
            engineName: true,
            model: true,
            searchEnabled: true,
          },
        },
        scanRun: {
          select: {
            brand: { select: { name: true } },
          },
        },
      },
    }),
    prisma.promptRun.findMany({
      where: {
        status: { in: ["failed", "skipped"] },
        errorMessage: { not: null },
        OR: [
          { finishedAt: { gte: lastDayStart } },
          { updatedAt: { gte: lastDayStart } },
        ],
        scanRun: {
          triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
        },
      },
      orderBy: [{ finishedAt: "desc" }, { updatedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        scanRunId: true,
        status: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        prompt: { select: { text: true } },
        engine: {
          select: {
            provider: true,
            engineName: true,
            model: true,
          },
        },
        scanRun: {
          select: {
            brandId: true,
            brand: { select: { name: true } },
          },
        },
      },
    }),
    prisma.scanRun.count({
      where: {
        triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
        status: "running",
        OR: [{ startedAt: null }, { startedAt: { lt: staleScanCutoff } }],
      },
    }),
    prisma.promptRun.count({
      where: {
        status: "running",
        OR: [{ startedAt: null }, { startedAt: { lt: stalePromptCutoff } }],
        scanRun: { triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] } },
      },
    }),
    prisma.emailEvent.count({
      where: {
        type: "failed",
        createdAt: { gte: lastDayStart },
      },
    }),
  ]);

  const activeScanSummaries = activeScans.map((scan) =>
    summarizeScan(scan, now),
  );
  const recentScanSummaries = recentScans.map((scan) =>
    summarizeScan(scan, now),
  );
  const completedDurations = recentScanSummaries
    .filter((scan) => scan.status === "completed" && scan.durationMs !== null)
    .map((scan) => scan.durationMs as number);

  return {
    generatedAt: now.toISOString(),
    window: {
      lastHourStart: lastHourStart.toISOString(),
      lastDayStart: lastDayStart.toISOString(),
    },
    health: {
      queuedScans: scanStatusCount(currentScanStatusGroups, "queued"),
      runningScans: scanStatusCount(currentScanStatusGroups, "running"),
      completedScans24h: scanStatusCount(lastDayScanStatusGroups, "completed"),
      failedScans24h: scanStatusCount(lastDayScanStatusGroups, "failed"),
      canceledScans24h: scanStatusCount(lastDayScanStatusGroups, "canceled"),
      staleRunningScans,
      staleRunningPromptRuns,
      oldestQueuedAgeMs: oldestAgeMs(activeScanSummaries, "queued", now),
      oldestRunningAgeMs: oldestAgeMs(activeScanSummaries, "running", now),
      averageCompletedScanDurationMs24h: average(completedDurations),
      emailFailures24h,
    },
    triggerTypes: summarizeTriggerTypes(activeScanSummaries),
    providers: summarizeProviders(providerPromptRuns),
    activeScans: activeScanSummaries,
    recentScans: recentScanSummaries,
    recentErrors: recentErrors.map((error) => ({
      id: error.id,
      scanRunId: error.scanRunId,
      brandId: error.scanRun.brandId,
      brandName: error.scanRun.brand.name,
      promptText: error.prompt.text,
      provider: error.engine.provider,
      engineName: error.engine.engineName,
      model: error.engine.model,
      status: error.status,
      errorMessage: error.errorMessage,
      startedAt: iso(error.startedAt),
      finishedAt: iso(error.finishedAt),
    })),
  };
}

function scanMonitorInclude() {
  return {
    brand: {
      select: {
        id: true,
        name: true,
        domain: true,
        organization: {
          select: {
            name: true,
            plan: true,
          },
        },
      },
    },
    scoreSnapshot: {
      select: {
        visibilityScore: true,
      },
    },
    promptRuns: {
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        updatedAt: true,
        errorMessage: true,
        engine: {
          select: {
            provider: true,
            engineName: true,
            model: true,
            searchEnabled: true,
          },
        },
        aiResponse: {
          select: {
            parsedResult: {
              select: {
                brandMentioned: true,
                brandRank: true,
                mentionCount: true,
                sentiment: true,
                confidence: true,
              },
            },
          },
        },
      },
    },
  };
}

function summarizeScan(scan: ScanRecord, now: Date): AdminScanMonitorScan {
  const promptCounts = countPromptStatuses(scan.promptRuns);
  const totalPromptRuns = scan.totalPromptRuns || scan.promptRuns.length;
  const finishedPromptRuns =
    promptCounts.completed + promptCounts.failed + promptCounts.skipped;
  const promptDurations = scan.promptRuns
    .map((promptRun) =>
      durationBetween(promptRun.startedAt, promptRun.finishedAt),
    )
    .filter((duration): duration is number => duration !== null);
  const latestError = latestPromptError(scan.promptRuns);
  const latestActivityAt = latestDate([
    scan.updatedAt,
    ...scan.promptRuns.flatMap((promptRun) => [
      promptRun.updatedAt,
      promptRun.finishedAt,
      promptRun.startedAt,
    ]),
  ]);
  const oldestRunningPromptStartedAt = oldestDate(
    scan.promptRuns
      .filter((promptRun) => promptRun.status === "running")
      .map((promptRun) => promptRun.startedAt),
  );

  return {
    id: scan.id,
    brandId: scan.brandId,
    brandName: scan.brand.name,
    brandDomain: scan.brand.domain,
    organizationName: scan.brand.organization.name,
    organizationPlan: scan.brand.organization.plan,
    status: scan.status,
    triggerType: scan.triggerType,
    createdAt: scan.createdAt.toISOString(),
    startedAt: iso(scan.startedAt),
    finishedAt: iso(scan.finishedAt),
    updatedAt: scan.updatedAt.toISOString(),
    durationMs: scanDurationMs(scan, now),
    ageMs: now.getTime() - scan.createdAt.getTime(),
    totalPromptRuns,
    promptCounts,
    progressPercent:
      totalPromptRuns > 0
        ? Math.round((finishedPromptRuns / totalPromptRuns) * 100)
        : 0,
    score: scan.scoreSnapshot?.visibilityScore ?? null,
    brandMentions: scan.promptRuns.filter(
      (promptRun) => promptRun.aiResponse?.parsedResult?.brandMentioned,
    ).length,
    latestActivityAt: iso(latestActivityAt),
    oldestRunningPromptStartedAt: iso(oldestRunningPromptStartedAt),
    averagePromptDurationMs: average(promptDurations),
    latestError: latestError?.errorMessage ?? null,
    providers: summarizeProviders(scan.promptRuns),
  };
}

function summarizeProviders(
  promptRuns: Array<PromptRunRecord | ProviderPromptRunRecord>,
): AdminProviderSummary[] {
  return PROVIDERS.map((provider) => {
    const runs = promptRuns.filter((run) => run.engine.provider === provider);
    const counts = countPromptStatuses(runs);
    const durations = runs
      .map((run) => durationBetween(run.startedAt, run.finishedAt))
      .filter((duration): duration is number => duration !== null);
    const latestError = latestPromptError(runs);

    return {
      provider,
      total: runs.length,
      queued: counts.queued,
      running: counts.running,
      completed: counts.completed,
      failed: counts.failed,
      skipped: counts.skipped,
      averageDurationMs: average(durations),
      latestError: latestError?.errorMessage ?? null,
    };
  }).filter((summary) => summary.total > 0);
}

function summarizeTriggerTypes(scans: AdminScanMonitorScan[]) {
  return SCAN_QUEUE_TRIGGER_TYPES.map((triggerType) => ({
    triggerType,
    queued: scans.filter(
      (scan) => scan.triggerType === triggerType && scan.status === "queued",
    ).length,
    running: scans.filter(
      (scan) => scan.triggerType === triggerType && scan.status === "running",
    ).length,
  })).filter((summary) => summary.queued > 0 || summary.running > 0);
}

function countPromptStatuses(
  promptRuns: Array<{ status: PromptRunStatus }>,
): Record<PromptRunStatus, number> {
  return PROMPT_STATUSES.reduce(
    (counts, status) => {
      counts[status] = promptRuns.filter((run) => run.status === status).length;
      return counts;
    },
    {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    } as Record<PromptRunStatus, number>,
  );
}

function scanStatusCount(
  groups: Array<{ status: ScanRunStatus; _count: { _all: number } }>,
  status: ScanRunStatus,
) {
  return groups.find((item) => item.status === status)?._count._all ?? 0;
}

function latestPromptError(promptRuns: Array<PromptRunRecord>) {
  return promptRuns
    .filter((run) => run.errorMessage)
    .sort(
      (left, right) =>
        dateValue(right.finishedAt ?? right.updatedAt) -
        dateValue(left.finishedAt ?? left.updatedAt),
    )[0];
}

function oldestAgeMs(
  scans: AdminScanMonitorScan[],
  status: ScanRunStatus,
  now: Date,
) {
  const dates = scans
    .filter((scan) => scan.status === status)
    .map((scan) => new Date(scan.createdAt));
  const oldest = oldestDate(dates);
  return oldest ? now.getTime() - oldest.getTime() : null;
}

function scanDurationMs(scan: ScanRecord, now: Date) {
  if (!scan.startedAt) return null;
  return (scan.finishedAt ?? now).getTime() - scan.startedAt.getTime();
}

function durationBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  return Math.max(0, end.getTime() - start.getTime());
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function latestDate(values: Array<Date | null>) {
  const dates = values.filter((value): value is Date => Boolean(value));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function oldestDate(values: Array<Date | null>) {
  const dates = values.filter((value): value is Date => Boolean(value));
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function dateValue(date: Date | null) {
  return date?.getTime() ?? 0;
}

function iso(date: Date | null) {
  return date ? date.toISOString() : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}
