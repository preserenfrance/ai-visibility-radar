import { prisma, resetStaleScanWork } from "@ai-radar/db";
import { runNextScanStep, scoreScan } from "@/lib/services";

export const SCAN_QUEUE_TRIGGER_TYPES = [
  "manual",
  "scheduled",
  "free_audit",
] as const;

const DEFAULT_MAX_SCAN_STEPS_PER_TICK = 120;
const DEFAULT_MAX_SCAN_STEPS_PER_SCAN_PER_TICK = 4;
const DEFAULT_SCAN_QUEUE_TIME_BUDGET_MS = 285_000;
const DEFAULT_MIN_STEP_START_BUDGET_MS = 45_000;
const DEFAULT_SCAN_QUEUE_MAX_ACTIVE_MS = 1000 * 60 * 60 * 2;
const MAX_EXPIRED_SCANS_PER_TICK = 25;
const ACTIVE_SCAN_STATUSES = ["queued", "running"] as const;

type ProcessScanQueueOptions = {
  maxSteps?: number;
  maxStepsPerScan?: number;
  timeBudgetMs?: number;
  minStepStartBudgetMs?: number;
};

export type ProcessScanQueueResult = {
  attemptedSteps: number;
  processedSteps: Array<{
    scanRunId: string;
    status: string | null;
    durationMs: number;
  }>;
  failedSteps: Array<{ scanRunId: string; error: string }>;
  settledExpired: number;
  remaining: number;
  exhaustedBudget: boolean;
};

export async function processScanQueueUntilBudget(
  options: ProcessScanQueueOptions = {},
): Promise<ProcessScanQueueResult> {
  await resetStaleScanWork();
  const expiredScanCleanup = await settleExpiredActiveScans();

  const maxSteps = options.maxSteps ?? DEFAULT_MAX_SCAN_STEPS_PER_TICK;
  const maxStepsPerScan =
    options.maxStepsPerScan ?? DEFAULT_MAX_SCAN_STEPS_PER_SCAN_PER_TICK;
  const timeBudgetMs =
    options.timeBudgetMs ?? DEFAULT_SCAN_QUEUE_TIME_BUDGET_MS;
  const minStepStartBudgetMs =
    options.minStepStartBudgetMs ?? DEFAULT_MIN_STEP_START_BUDGET_MS;
  const deadline = Date.now() + timeBudgetMs;
  const stepCounts = new Map<string, number>();
  const processedSteps: ProcessScanQueueResult["processedSteps"] = [];
  const failedSteps: ProcessScanQueueResult["failedSteps"] = [];
  let attemptedSteps = 0;

  while (
    attemptedSteps < maxSteps &&
    Date.now() < deadline - minStepStartBudgetMs
  ) {
    const scan = await nextPendingScanForQueue(stepCounts, maxStepsPerScan);
    if (!scan) break;

    attemptedSteps += 1;
    stepCounts.set(scan.id, (stepCounts.get(scan.id) ?? 0) + 1);
    const startedAt = Date.now();
    try {
      const updatedScan = await runNextScanStep(scan.id);
      processedSteps.push({
        scanRunId: scan.id,
        status: updatedScan?.status ?? null,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      failedSteps.push({
        scanRunId: scan.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await resetStaleScanWork();
    }
  }

  const remaining = await prisma.scanRun.count({
    where: {
      triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
      status: { in: ["queued", "running"] },
    },
  });

  return {
    attemptedSteps,
    processedSteps,
    failedSteps,
    settledExpired: expiredScanCleanup.settled,
    remaining,
    exhaustedBudget: Date.now() >= deadline - minStepStartBudgetMs,
  };
}

export function scanQueueMaxActiveMs(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.SCAN_QUEUE_MAX_ACTIVE_MS);
  if (!Number.isFinite(parsed) || parsed < 1000 * 60 * 10) {
    return DEFAULT_SCAN_QUEUE_MAX_ACTIVE_MS;
  }
  return Math.floor(parsed);
}

export async function settleExpiredActiveScans(now = new Date()) {
  const cutoff = new Date(now.getTime() - scanQueueMaxActiveMs());
  const expiredScans = await prisma.scanRun.findMany({
    where: {
      triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
      status: { in: [...ACTIVE_SCAN_STATUSES] },
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_EXPIRED_SCANS_PER_TICK,
    select: { id: true },
  });

  const settledScans = await Promise.allSettled(
    expiredScans.map((scan) =>
      settleScanRun(
        scan.id,
        "Scan je bil zakljucen, ker je bil predolgo v queueju.",
      ),
    ),
  );

  return {
    checked: expiredScans.length,
    settled: settledScans.filter((result) => result.status === "fulfilled")
      .length,
    failed: settledScans
      .map((result, index) =>
        result.status === "rejected"
          ? {
              scanRunId: expiredScans[index]?.id ?? null,
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            }
          : null,
      )
      .filter((result): result is { scanRunId: string | null; error: string } =>
        Boolean(result),
      ),
  };
}

export async function settleScanRun(
  scanRunId: string,
  reason = "Scan je bil zakljucen v admin monitorju.",
) {
  const finishedAt = new Date();
  await prisma.promptRun.updateMany({
    where: {
      scanRunId,
      status: { in: [...ACTIVE_SCAN_STATUSES] },
    },
    data: {
      status: "skipped",
      finishedAt,
      errorMessage: reason,
    },
  });

  await scoreScan(scanRunId);

  return prisma.scanRun.findUnique({
    where: { id: scanRunId },
    select: {
      id: true,
      status: true,
      completedPromptRuns: true,
      failedPromptRuns: true,
      scoreSnapshot: { select: { visibilityScore: true } },
    },
  });
}

export async function cancelActiveScanRun(
  scanRunId: string,
  reason = "Scan je bil preklican v admin monitorju.",
) {
  const finishedAt = new Date();
  const canceled = await prisma.scanRun.updateMany({
    where: {
      id: scanRunId,
      status: { in: [...ACTIVE_SCAN_STATUSES] },
    },
    data: {
      status: "canceled",
      finishedAt,
    },
  });

  await prisma.promptRun.updateMany({
    where: {
      scanRunId,
      status: { in: [...ACTIVE_SCAN_STATUSES] },
    },
    data: {
      status: "skipped",
      finishedAt,
      errorMessage: reason,
    },
  });

  const scan = await prisma.scanRun.findUnique({
    where: { id: scanRunId },
    select: {
      id: true,
      status: true,
      completedPromptRuns: true,
      failedPromptRuns: true,
      scoreSnapshot: { select: { visibilityScore: true } },
      _count: { select: { promptRuns: true } },
    },
  });

  return { scan, canceled: canceled.count > 0 };
}

async function nextPendingScanForQueue(
  stepCounts: Map<string, number>,
  maxStepsPerScan: number,
) {
  const exhaustedIds = [...stepCounts.entries()]
    .filter(([, count]) => count >= maxStepsPerScan)
    .map(([scanRunId]) => scanRunId);
  const idFilter = exhaustedIds.length ? { id: { notIn: exhaustedIds } } : {};
  const baseWhere = {
    triggerType: { in: [...SCAN_QUEUE_TRIGGER_TYPES] },
    ...idFilter,
  };

  return (
    (await prisma.scanRun.findFirst({
      where: {
        ...baseWhere,
        status: "running",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })) ??
    prisma.scanRun.findFirst({
      where: {
        ...baseWhere,
        status: "queued",
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
  );
}
