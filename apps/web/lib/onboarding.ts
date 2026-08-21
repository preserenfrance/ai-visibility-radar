import { prisma } from "@ai-radar/db";

export type OnboardingStepKey =
  | "first_scan"
  | "prompt_depth"
  | "competitor_map"
  | "source_intelligence"
  | "improvement_loop"
  | "measurement_habit";

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  cta: string;
  href: string;
  completed: boolean;
  locked: boolean;
  metric: string;
};

export type BrandOnboardingStats = {
  brandId: string;
  brandName: string;
  organizationId: string;
  latestScanId?: string;
  latestScanAt?: Date | null;
  activePromptCount: number;
  competitorCount: number;
  completedScanCount: number;
  manualCompletedScanCount: number;
  citationCount: number;
  contentReviewCount: number;
  touchedRecommendationCount: number;
  recurringActive: boolean;
  scheduledScan: boolean;
  manualScanAccess: boolean;
};

export type OnboardingUsageStats = BrandOnboardingStats;

export type OnboardingSummary = {
  stats: BrandOnboardingStats;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  nextStep: OnboardingStep | null;
};

export type OnboardingLevelKey =
  | "no_brand"
  | "started"
  | "progressing"
  | "advanced"
  | "complete";

export type OnboardingLevel = {
  key: OnboardingLevelKey;
  label: string;
};

export type UserOnboardingLevel = {
  userId: string;
  totalBrands: number;
  completedBrands: number;
  completionPercent: number;
  level: OnboardingLevel;
  weakestBrand?: {
    brandId: string;
    brandName: string;
    completionPercent: number;
    nextStep: OnboardingStep | null;
  };
};

export type OnboardingAnalyticsUser = UserOnboardingLevel & {
  email: string;
  name: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  brandSummaries?: OnboardingSummary[];
};

export type OnboardingFunnelStep = {
  key: string;
  label: string;
  count: number;
  conversionPercent: number;
};

export type OnboardingCohort = {
  key: string;
  label: string;
  users: number;
  activatedUsers: number;
  deepUsers: number;
  repeatUsers: number;
  activationRate: number;
  deepUsageRate: number;
  repeatRate: number;
};

export type OnboardingAnalytics = {
  users: OnboardingAnalyticsUser[];
  totalUsers: number;
  totalBrands: number;
  activatedUsers: number;
  deepUsers: number;
  repeatUsers: number;
  recentlyActiveUsers: number;
  atRiskUsers: number;
  activationRate: number;
  deepUsageRate: number;
  repeatRate: number;
  recentlyActiveRate: number;
  funnel: OnboardingFunnelStep[];
  cohorts: OnboardingCohort[];
  usersNeedingHelp: Array<
    OnboardingAnalyticsUser & {
      nextStep: OnboardingStep | null;
      brandId?: string;
      brandName?: string;
      brandCompletionPercent?: number;
    }
  >;
};

const PROMPT_DEPTH_TARGET = 8;
const COMPETITOR_TARGET = 2;
const COHORT_COUNT = 8;

type BrandCitationCountRow = {
  brand_id: string;
  citation_count: bigint | number;
};

type BrandOnboardingRecord = {
  id: string;
  name: string;
  organizationId: string;
  recurringScanActive: boolean;
  recurringScanNextRunAt: Date | null;
  organization: {
    plan: string;
    memberships?: Array<{ userId: string }>;
  };
  _count: {
    competitors: number;
    promptContentReviews: number;
  };
  promptSets: Array<{
    prompts: Array<{ id: string }>;
  }>;
  recommendations: Array<{ id: string }>;
};

type CompletedScan = {
  id: string;
  brandId: string;
  triggerType: string;
  createdAt: Date;
};

export async function getBrandOnboardingSummary(
  brandId: string,
): Promise<OnboardingSummary> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      recurringScanActive: true,
      recurringScanNextRunAt: true,
      organization: {
        select: {
          plan: true,
        },
      },
      _count: {
        select: {
          competitors: true,
          promptContentReviews: true,
        },
      },
      promptSets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          prompts: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
      recommendations: {
        where: { status: { in: ["in_progress", "done"] } },
        select: { id: true },
      },
    },
  });
  if (!brand) throw new Error("Brand not found");

  const [
    completedScanCount,
    manualCompletedScanCount,
    latestScan,
    citationCount,
  ] = await Promise.all([
    prisma.scanRun.count({
      where: {
        brandId,
        status: "completed",
      },
    }),
    prisma.scanRun.count({
      where: {
        brandId,
        status: "completed",
        triggerType: "manual",
      },
    }),
    prisma.scanRun.findFirst({
      where: {
        brandId,
        status: "completed",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        brandId: true,
        triggerType: true,
        createdAt: true,
      },
    }),
    prisma.citation.count({
      where: {
        aiResponse: {
          promptRun: {
            scanRun: {
              brandId,
            },
          },
        },
      },
    }),
  ]);

  return buildOnboardingSummary(
    statsFromBrand({
      brand,
      completedScanCount,
      manualCompletedScanCount,
      latestScan,
      citationCount,
    }),
  );
}

export async function getUserBrandOnboardingOverview(
  userId: string,
): Promise<UserOnboardingLevel & { summaries: OnboardingSummary[] }> {
  const brands = await prisma.brand.findMany({
    where: {
      organization: {
        plan: { not: "disabled" },
        memberships: { some: { userId } },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const summaries = await Promise.all(
    brands.map((brand) => getBrandOnboardingSummary(brand.id)),
  );

  return {
    ...buildUserOnboardingLevel(userId, summaries),
    summaries,
  };
}

export async function getAdminUserOnboardingLevels(): Promise<
  Map<string, UserOnboardingLevel>
> {
  const analytics = await getAdminOnboardingAnalytics();
  return new Map(
    analytics.users.map((user) => [
      user.userId,
      {
        userId: user.userId,
        totalBrands: user.totalBrands,
        completedBrands: user.completedBrands,
        completionPercent: user.completionPercent,
        level: user.level,
        weakestBrand: user.weakestBrand,
      },
    ]),
  );
}

export async function getAdminOnboardingAnalytics(
  now = new Date(),
): Promise<OnboardingAnalytics> {
  const [users, brands, citationRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.brand.findMany({
      where: {
        organization: {
          plan: { not: "disabled" },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        organizationId: true,
        recurringScanActive: true,
        recurringScanNextRunAt: true,
        organization: {
          select: {
            plan: true,
            memberships: {
              select: { userId: true },
            },
          },
        },
        _count: {
          select: {
            competitors: true,
            promptContentReviews: true,
          },
        },
        promptSets: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            prompts: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
        scanRuns: {
          where: { status: "completed" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            brandId: true,
            triggerType: true,
            createdAt: true,
          },
        },
        recommendations: {
          where: { status: { in: ["in_progress", "done"] } },
          select: { id: true },
        },
      },
    }),
    prisma.$queryRaw<BrandCitationCountRow[]>`
      SELECT b.id AS brand_id, COUNT(DISTINCT c.id) AS citation_count
      FROM "Brand" b
      JOIN "Organization" o ON o.id = b."organizationId"
      JOIN "ScanRun" sr ON sr."brandId" = b.id
      JOIN "PromptRun" pr ON pr."scanRunId" = sr.id
      JOIN "AiResponse" ar ON ar."promptRunId" = pr.id
      JOIN "Citation" c ON c."aiResponseId" = ar.id
      WHERE o."plan" <> 'disabled'
      GROUP BY b.id
    `,
  ]);

  const citationsByBrandId = new Map(
    citationRows.map((row) => [row.brand_id, Number(row.citation_count)]),
  );
  const brandSummaries = brands.map((brand) =>
    buildOnboardingSummary(
      statsFromBrand({
        brand,
        completedScanCount: brand.scanRuns.length,
        manualCompletedScanCount: brand.scanRuns.filter(
          (scan) => scan.triggerType === "manual",
        ).length,
        latestScan: brand.scanRuns[0] ?? null,
        citationCount: citationsByBrandId.get(brand.id) ?? 0,
      }),
    ),
  );
  const summariesByBrandId = new Map(
    brandSummaries.map((summary) => [summary.stats.brandId, summary]),
  );

  const analyticsUsers = users.map((user) => {
    const userBrandSummaries = brands
      .filter((brand) =>
        brand.organization.memberships?.some(
          (membership) => membership.userId === user.id,
        ),
      )
      .map((brand) => summariesByBrandId.get(brand.id))
      .filter((summary): summary is OnboardingSummary => Boolean(summary));

    return {
      ...buildUserOnboardingLevel(user.id, userBrandSummaries),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      brandSummaries: userBrandSummaries,
    };
  });

  return summarizeOnboardingAnalytics(analyticsUsers, now, brandSummaries);
}

export function buildOnboardingSummary(
  stats: BrandOnboardingStats,
): OnboardingSummary {
  const steps = buildOnboardingSteps(stats);
  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  return {
    stats,
    steps,
    completedCount,
    totalCount,
    completionPercent: percent(completedCount, totalCount),
    nextStep: steps.find((step) => !step.completed && !step.locked) ?? null,
  };
}

export function buildOnboardingSteps(
  stats: BrandOnboardingStats,
): OnboardingStep[] {
  const hasCompletedScan = stats.completedScanCount > 0;
  const brandHref = `/app/brands/${stats.brandId}`;
  const scanHref = stats.latestScanId
    ? `/app/brands/${stats.brandId}/scans/${stats.latestScanId}`
    : brandHref;
  const promptHref = `/app/brands/${stats.brandId}/prompts`;
  const competitorsHref = `/app/brands/${stats.brandId}/competitors`;
  const citationsHref = `/app/brands/${stats.brandId}/citations`;
  const actionsHref = `/app/brands/${stats.brandId}/actions`;
  const habitComplete =
    stats.completedScanCount >= 2 ||
    (stats.recurringActive && stats.scheduledScan);

  return [
    {
      key: "first_scan",
      title: "Review the first AI scan",
      description:
        "Open the first completed scan to inspect model answers, ranks, mentions and evidence for this brand.",
      cta: hasCompletedScan ? "Open latest scan" : "Run first scan",
      href: scanHref,
      completed: hasCompletedScan,
      locked: false,
      metric: `${stats.completedScanCount} completed scans`,
    },
    {
      key: "prompt_depth",
      title: `Reach ${PROMPT_DEPTH_TARGET} active buyer questions`,
      description:
        "Broader prompts expose more buying moments and make trend data more useful for this brand.",
      cta: "Improve prompts",
      href: promptHref,
      completed: stats.activePromptCount >= PROMPT_DEPTH_TARGET,
      locked: false,
      metric: `${stats.activePromptCount}/${PROMPT_DEPTH_TARGET} active prompts`,
    },
    {
      key: "competitor_map",
      title: `Map ${COMPETITOR_TARGET} competitors`,
      description:
        "Competitors make share of voice, mentions and cited domains easier to interpret.",
      cta: "Add competitors",
      href: competitorsHref,
      completed: stats.competitorCount >= COMPETITOR_TARGET,
      locked: false,
      metric: `${stats.competitorCount}/${COMPETITOR_TARGET} competitors`,
    },
    {
      key: "source_intelligence",
      title: "Inspect cited sources",
      description:
        "Source review shows which domains AI models trust for this category.",
      cta: "Open citations",
      href: citationsHref,
      completed: stats.citationCount > 0,
      locked: !hasCompletedScan,
      metric: `${stats.citationCount} citations`,
    },
    {
      key: "improvement_loop",
      title: "Start the improvement loop",
      description:
        "Use content reviews or recommendation statuses to turn this brand's scan output into action.",
      cta: stats.manualScanAccess ? "Open improvement ideas" : "Open ideas",
      href: actionsHref,
      completed:
        stats.contentReviewCount > 0 || stats.touchedRecommendationCount > 0,
      locked: !hasCompletedScan,
      metric: `${stats.contentReviewCount} content reviews`,
    },
    {
      key: "measurement_habit",
      title: "Build a measurement habit",
      description:
        "Repeated scans make movement visible and keep weekly monitoring alive for this brand.",
      cta: "Open brand dashboard",
      href: brandHref,
      completed: habitComplete,
      locked: false,
      metric: stats.recurringActive
        ? stats.scheduledScan
          ? "recurring scan scheduled"
          : "recurring scan active"
        : `${stats.completedScanCount}/2 completed scans`,
    },
  ];
}

export function buildUserOnboardingLevel(
  userId: string,
  summaries: OnboardingSummary[],
): UserOnboardingLevel {
  const completedBrands = summaries.filter(
    (summary) => !summary.nextStep,
  ).length;
  const completionPercent =
    summaries.length === 0
      ? 0
      : percent(
          summaries.reduce(
            (sum, summary) => sum + summary.completionPercent,
            0,
          ),
          summaries.length * 100,
        );
  const weakestSummary = [...summaries].sort(
    (left, right) =>
      left.completionPercent - right.completionPercent ||
      left.stats.brandName.localeCompare(right.stats.brandName),
  )[0];

  return {
    userId,
    totalBrands: summaries.length,
    completedBrands,
    completionPercent,
    level: onboardingLevelForCompletion(completionPercent, summaries.length),
    weakestBrand: weakestSummary
      ? {
          brandId: weakestSummary.stats.brandId,
          brandName: weakestSummary.stats.brandName,
          completionPercent: weakestSummary.completionPercent,
          nextStep: weakestSummary.nextStep,
        }
      : undefined,
  };
}

export function onboardingLevelForCompletion(
  completionPercent: number,
  totalBrands: number,
): OnboardingLevel {
  if (totalBrands === 0) return { key: "no_brand", label: "No brand" };
  if (completionPercent >= 100) return { key: "complete", label: "Complete" };
  if (completionPercent >= 75) return { key: "advanced", label: "Advanced" };
  if (completionPercent >= 40)
    return { key: "progressing", label: "Progressing" };
  return { key: "started", label: "Started" };
}

export function summarizeOnboardingAnalytics(
  users: OnboardingAnalyticsUser[],
  now = new Date(),
  brandSummariesForFunnel?: OnboardingSummary[],
): OnboardingAnalytics {
  const allBrandSummaries =
    brandSummariesForFunnel ??
    uniqueBrandSummaries(users.flatMap((user) => user.brandSummaries ?? []));
  const recentlyActiveCutoff = addDays(now, -7);
  const activatedUsers = users.filter(isActivatedUser).length;
  const deepUsers = users.filter(isDeepUser).length;
  const repeatUsers = users.filter(isRepeatUser).length;
  const recentlyActiveUsers = users.filter(
    (user) => user.lastSeenAt && user.lastSeenAt >= recentlyActiveCutoff,
  ).length;
  const atRiskUsers = users.filter((user) => isAtRiskUser(user, now)).length;
  const funnel = buildFunnel(allBrandSummaries);
  const cohorts = buildSignupCohorts(users, now, COHORT_COUNT);
  const usersNeedingHelp = users
    .map((user) => ({
      ...user,
      nextStep: user.weakestBrand?.nextStep ?? null,
      brandId: user.weakestBrand?.brandId,
      brandName: user.weakestBrand?.brandName,
      brandCompletionPercent: user.weakestBrand?.completionPercent,
    }))
    .filter((user) => user.nextStep)
    .sort(
      (left, right) =>
        left.completionPercent - right.completionPercent ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    )
    .slice(0, 20);

  return {
    users,
    totalUsers: users.length,
    totalBrands: allBrandSummaries.length,
    activatedUsers,
    deepUsers,
    repeatUsers,
    recentlyActiveUsers,
    atRiskUsers,
    activationRate: percent(activatedUsers, users.length),
    deepUsageRate: percent(deepUsers, users.length),
    repeatRate: percent(repeatUsers, users.length),
    recentlyActiveRate: percent(recentlyActiveUsers, users.length),
    funnel,
    cohorts,
    usersNeedingHelp,
  };
}

function uniqueBrandSummaries(summaries: OnboardingSummary[]) {
  return [
    ...new Map(
      summaries.map((summary) => [summary.stats.brandId, summary]),
    ).values(),
  ];
}

function statsFromBrand(input: {
  brand: BrandOnboardingRecord;
  completedScanCount: number;
  manualCompletedScanCount: number;
  latestScan?: CompletedScan | null;
  citationCount: number;
}): BrandOnboardingStats {
  return {
    brandId: input.brand.id,
    brandName: input.brand.name,
    organizationId: input.brand.organizationId,
    latestScanId: input.latestScan?.id,
    latestScanAt: input.latestScan?.createdAt,
    activePromptCount: input.brand.promptSets.reduce(
      (sum, promptSet) => sum + promptSet.prompts.length,
      0,
    ),
    competitorCount: input.brand._count.competitors,
    completedScanCount: input.completedScanCount,
    manualCompletedScanCount: input.manualCompletedScanCount,
    citationCount: input.citationCount,
    contentReviewCount: input.brand._count.promptContentReviews,
    touchedRecommendationCount: input.brand.recommendations.length,
    recurringActive: input.brand.recurringScanActive,
    scheduledScan: Boolean(
      input.brand.recurringScanActive && input.brand.recurringScanNextRunAt,
    ),
    manualScanAccess:
      input.brand.organization.plan === "starter" ||
      input.brand.organization.plan === "growth",
  };
}

function buildFunnel(
  brandSummaries: OnboardingSummary[],
): OnboardingFunnelStep[] {
  const steps = [
    {
      key: "active_brands",
      label: "Active brands",
      count: brandSummaries.length,
    },
    ...(
      [
        ["first_scan", "Completed first scan"],
        ["prompt_depth", `${PROMPT_DEPTH_TARGET}+ active prompts`],
        ["competitor_map", `${COMPETITOR_TARGET}+ competitors`],
        ["source_intelligence", "Inspected cited sources"],
        ["improvement_loop", "Started improvement loop"],
        ["measurement_habit", "Repeated measurement"],
      ] satisfies Array<[OnboardingStepKey, string]>
    ).map(([key, label]) => ({
      key,
      label,
      count: brandSummaries.filter((summary) =>
        summary.steps.some((step) => step.key === key && step.completed),
      ).length,
    })),
  ];

  return steps.map((step) => ({
    ...step,
    conversionPercent: percent(step.count, brandSummaries.length),
  }));
}

function buildSignupCohorts(
  users: OnboardingAnalyticsUser[],
  now: Date,
  count: number,
): OnboardingCohort[] {
  const weekStarts = Array.from({ length: count }, (_, index) => {
    const start = startOfWeek(now);
    start.setDate(start.getDate() - (count - index - 1) * 7);
    return start;
  });

  return weekStarts.map((start) => {
    const end = addDays(start, 7);
    const cohortUsers = users.filter(
      (user) => user.createdAt >= start && user.createdAt < end,
    );
    const activatedUsers = cohortUsers.filter(isActivatedUser).length;
    const deepUsers = cohortUsers.filter(isDeepUser).length;
    const repeatUsers = cohortUsers.filter(isRepeatUser).length;
    return {
      key: dayKey(start),
      label: `${start.getDate()}.${start.getMonth() + 1}.`,
      users: cohortUsers.length,
      activatedUsers,
      deepUsers,
      repeatUsers,
      activationRate: percent(activatedUsers, cohortUsers.length),
      deepUsageRate: percent(deepUsers, cohortUsers.length),
      repeatRate: percent(repeatUsers, cohortUsers.length),
    };
  });
}

function isActivatedUser(user: OnboardingAnalyticsUser) {
  return Boolean(
    user.brandSummaries?.some((summary) =>
      summary.steps.some((step) => step.key === "first_scan" && step.completed),
    ),
  );
}

function isDeepUser(user: OnboardingAnalyticsUser) {
  return user.totalBrands > 0 && user.completionPercent >= 67;
}

function isRepeatUser(user: OnboardingAnalyticsUser) {
  return Boolean(
    user.brandSummaries?.some((summary) =>
      summary.steps.some(
        (step) => step.key === "measurement_habit" && step.completed,
      ),
    ),
  );
}

function isAtRiskUser(user: OnboardingAnalyticsUser, now: Date) {
  const staleCutoff = addDays(now, -14);
  return (
    user.totalBrands === 0 ||
    (user.totalBrands > 0 && user.completionPercent < 50) ||
    (user.totalBrands > 0 &&
      user.completionPercent < 100 &&
      (!user.lastSeenAt || user.lastSeenAt < staleCutoff))
  );
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  return copy;
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
