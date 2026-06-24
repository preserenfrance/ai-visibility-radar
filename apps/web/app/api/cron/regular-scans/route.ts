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
const MAX_SCAN_STEPS_PER_TICK = 3;

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
          plan: { not: "growth" },
        },
      },
      data: {
        recurringScanActive: false,
        recurringScanPlan: null,
        recurringScanCadence: null,
        recurringScanNextRunAt: null,
      },
    });
    const growthRecurringData = recurringScanActivationData("growth", now);
    const activatedGrowthBrands = growthRecurringData
      ? await prisma.brand.updateMany({
          where: {
            organization: {
              plan: "growth",
            },
            OR: [
              { recurringScanActive: false },
              { recurringScanCadence: null },
              { recurringScanCadence: { not: "weekly" } },
              { recurringScanPlan: null },
              { recurringScanPlan: { not: "growth" } },
              { recurringScanNextRunAt: null },
            ],
          },
          data: growthRecurringData,
        })
      : { count: 0 };

    const dueBrands = await prisma.brand.findMany({
      where: {
        recurringScanActive: true,
        recurringScanNextRunAt: { lte: now },
        organization: {
          plan: "growth",
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

    const pendingScans = await prisma.scanRun.findMany({
      where: {
        triggerType: "scheduled",
        status: { in: ["queued", "running"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: MAX_SCAN_STEPS_PER_TICK,
    });

    const processedSteps: string[] = [];
    for (const scan of pendingScans) {
      await runNextScanStep(scan.id).catch(() => null);
      processedSteps.push(scan.id);
    }

    return ok({
      deactivatedWithoutAutomation: deactivatedWithoutAutomation.count,
      activatedGrowthBrands: activatedGrowthBrands.count,
      createdScans,
      failedBrands,
      processedSteps,
    });
  });
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
