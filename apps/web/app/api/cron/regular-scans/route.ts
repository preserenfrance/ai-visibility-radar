import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { fail, ok, route } from "@/lib/http";
import {
  createScanForBrand,
  nextRecurringScanDate,
  recurringScanActivationData,
  recurringScanCadenceForPlan,
  recurringScanEngineVariantsFromJson,
  runNextScanStep,
} from "@/lib/services";

export const maxDuration = 60;

const MAX_NEW_SCANS_PER_TICK = 20;
const MAX_SCAN_STEPS_PER_TICK = 30;
const MAX_SCAN_STEPS_PER_SCAN_PER_TICK = 4;
const SCAN_QUEUE_TIME_BUDGET_MS = 55_000;
const MIN_STEP_START_BUDGET_MS = 45_000;
const RECURRING_SCAN_PLANS = ["free", "starter", "growth"] as const;
const QUEUE_TRIGGER_TYPES = ["manual", "scheduled", "free_audit"] as const;

export async function GET(request: Request) {
  return runRegularScans(request);
}

export async function POST(request: Request) {
  return runRegularScans(request);
}

function runRegularScans(request: Request) {
  return route(async () => {
    if (!isAuthorizedCronRequest(request))
      return fail("Cron ni avtoriziran.", 401);

    const now = new Date();
    const deactivatedWithoutAutomation = await prisma.brand.updateMany({
      where: {
        recurringScanActive: true,
        organization: {
          plan: { notIn: [...RECURRING_SCAN_PLANS] },
        },
      },
      data: {
        recurringScanActive: false,
        recurringScanPlan: null,
        recurringScanCadence: null,
        recurringScanNextRunAt: null,
      },
    });
    let activatedRecurringBrands = 0;
    for (const plan of RECURRING_SCAN_PLANS) {
      const recurringData = recurringScanActivationData(plan, now);
      if (!recurringData) continue;

      const result = await prisma.brand.updateMany({
        where: {
          organization: {
            plan,
          },
          OR: [
            { recurringScanActive: false },
            { recurringScanCadence: null },
            { recurringScanCadence: { not: "weekly" } },
            { recurringScanPlan: null },
            { recurringScanPlan: { not: plan } },
            { recurringScanNextRunAt: null },
          ],
        },
        data: recurringData,
      });
      activatedRecurringBrands += result.count;
    }

    const dueBrands = await prisma.brand.findMany({
      where: {
        recurringScanActive: true,
        recurringScanNextRunAt: { lte: now },
        organization: {
          plan: {
            in: [...RECURRING_SCAN_PLANS],
          },
        },
        promptSets: {
          some: {
            status: "active",
            prompts: { some: { isActive: true } },
          },
        },
      },
      include: {
        organization: { include: { billingSubscription: true } },
      },
      orderBy: { recurringScanNextRunAt: "asc" },
      take: MAX_NEW_SCANS_PER_TICK,
    });

    const createdScans: string[] = [];
    const failedBrands: string[] = [];
    for (const brand of dueBrands) {
      const cadence =
        brand.recurringScanCadence ??
        recurringScanCadenceForPlan(brand.organization.plan);
      if (!cadence) continue;
      try {
        const limits = PLAN_LIMITS[brand.organization.plan];
        const scan = await createScanForBrand(brand.id, {
          triggerType: "scheduled",
          promptLimit: limits.promptsPerBrand,
          repeatCount: 1,
          runNow: false,
          engineVariants: recurringScanEngineVariantsFromJson(
            brand.recurringScanProviderVariants,
          ),
        });
        if (scan?.id) createdScans.push(scan.id);

        await prisma.brand.update({
          where: { id: brand.id },
          data: {
            recurringScanLastRunAt: now,
            recurringScanNextRunAt: nextRecurringScanDate(cadence, now),
          },
        });
      } catch (error) {
        failedBrands.push(brand.id);
        console.error("Regular scan creation failed", {
          brandId: brand.id,
          error,
        });
      }
    }

    const scanQueue = await processScanQueueUntilBudget();

    return ok({
      deactivatedWithoutAutomation: deactivatedWithoutAutomation.count,
      activatedRecurringBrands,
      createdScans,
      failedBrands,
      scanQueue,
    });
  });
}

async function processScanQueueUntilBudget() {
  const deadline = Date.now() + SCAN_QUEUE_TIME_BUDGET_MS;
  const stepCounts = new Map<string, number>();
  const processedSteps: Array<{
    scanRunId: string;
    status: string | null;
    durationMs: number;
  }> = [];
  const failedSteps: Array<{ scanRunId: string; error: string }> = [];
  let attemptedSteps = 0;

  while (
    attemptedSteps < MAX_SCAN_STEPS_PER_TICK &&
    Date.now() < deadline - MIN_STEP_START_BUDGET_MS
  ) {
    const scan = await nextPendingScanForCron(stepCounts);
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
    }
  }

  const remaining = await prisma.scanRun.count({
    where: {
      triggerType: { in: [...QUEUE_TRIGGER_TYPES] },
      status: { in: ["queued", "running"] },
    },
  });

  return {
    attemptedSteps,
    processedSteps,
    failedSteps,
    remaining,
    exhaustedBudget: Date.now() >= deadline - MIN_STEP_START_BUDGET_MS,
  };
}

async function nextPendingScanForCron(stepCounts: Map<string, number>) {
  const exhaustedIds = [...stepCounts.entries()]
    .filter(([, count]) => count >= MAX_SCAN_STEPS_PER_SCAN_PER_TICK)
    .map(([scanRunId]) => scanRunId);
  const idFilter = exhaustedIds.length ? { id: { notIn: exhaustedIds } } : {};
  const baseWhere = {
    triggerType: { in: [...QUEUE_TRIGGER_TYPES] },
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

function isAuthorizedCronRequest(request: Request) {
  const config = getConfig();
  if (!config.CRON_SECRET) return true;
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  return token === config.CRON_SECRET || querySecret === config.CRON_SECRET;
}
