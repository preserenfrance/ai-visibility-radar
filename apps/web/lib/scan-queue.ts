import { prisma, resetStaleScanWork } from "@ai-radar/db";
import { runNextScanStep } from "@/lib/services";

export const SCAN_QUEUE_TRIGGER_TYPES = [
  "manual",
  "scheduled",
  "free_audit",
] as const;

const DEFAULT_MAX_SCAN_STEPS_PER_TICK = 120;
const DEFAULT_MAX_SCAN_STEPS_PER_SCAN_PER_TICK = 4;
const DEFAULT_SCAN_QUEUE_TIME_BUDGET_MS = 285_000;
const DEFAULT_MIN_STEP_START_BUDGET_MS = 45_000;

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
  remaining: number;
  exhaustedBudget: boolean;
};

export async function processScanQueueUntilBudget(
  options: ProcessScanQueueOptions = {},
): Promise<ProcessScanQueueResult> {
  await resetStaleScanWork();

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
    remaining,
    exhaustedBudget: Date.now() >= deadline - minStepStartBudgetMs,
  };
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
