import { prisma } from "@ai-radar/db";

export type OnboardingStepKey =
  | "create_brand"
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

export type OnboardingUsageStats = {
  userId?: string;
  email?: string;
  name?: string | null;
  createdAt?: Date | null;
  lastSeenAt?: Date | null;
  organizationCount: number;
  brandCount: number;
  primaryBrandId?: string;
  primaryBrandName?: string;
  latestScanId?: string;
  latestScanBrandId?: string;
  latestScanAt?: Date | null;
  activePromptCount: number;
  competitorCount: number;
  completedScanCount: number;
  manualCompletedScanCount: number;
  citationCount: number;
  contentReviewCount: number;
  touchedRecommendationCount: number;
  recurringActiveCount: number;
  scheduledScanCount: number;
  manualScanAccess: boolean;
};

export type OnboardingSummary = {
  stats: OnboardingUsageStats;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  nextStep: OnboardingStep | null;
};

export type OnboardingAnalyticsUser = OnboardingUsageStats & {
  userId: string;
  email: string;
  createdAt: Date;
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
      completionPercent: number;
    }
  >;
};

const PROMPT_DEPTH_TARGET = 8;
const COMPETITOR_TARGET = 2;
const COHORT_COUNT = 8;

type CitationCountRow = {
  user_id: string;
  citation_count: bigint | number;
};

export async function getUserOnboardingSummary(
  userId: string,
): Promise<OnboardingSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastSeenAt: true,
      memberships: {
        select: {
          organization: {
            select: {
              id: true,
              plan: true,
              brands: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  name: true,
                  recurringScanActive: true,
                  recurringScanNextRunAt: true,
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
              },
            },
          },
        },
      },
    },
  });
  if (!user) throw new Error("User not found");

  const brandWhere = {
    organization: {
      plan: { not: "disabled" as const },
      memberships: { some: { userId } },
    },
  };

  const [
    completedScanCount,
    manualCompletedScanCount,
    latestScan,
    citationCount,
  ] = await Promise.all([
    prisma.scanRun.count({
      where: {
        status: "completed",
        brand: brandWhere,
      },
    }),
    prisma.scanRun.count({
      where: {
        status: "completed",
        triggerType: "manual",
        brand: brandWhere,
      },
    }),
    prisma.scanRun.findFirst({
      where: {
        status: "completed",
        brand: brandWhere,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        brandId: true,
        createdAt: true,
      },
    }),
    prisma.citation.count({
      where: {
        aiResponse: {
          promptRun: {
            scanRun: {
              brand: brandWhere,
            },
          },
        },
      },
    }),
  ]);

  const activeOrganizations = user.memberships
    .map((membership) => membership.organization)
    .filter((organization) => organization.plan !== "disabled");
  const brands = activeOrganizations.flatMap(
    (organization) => organization.brands,
  );
  const primaryBrand =
    brands.find((brand) => brand.id === latestScan?.brandId) ?? brands[0];
  const stats = statsFromUserBrands({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
    },
    activeOrganizations,
    brands,
    citationCount,
    completedScanCount,
    manualCompletedScanCount,
    latestScan,
    primaryBrand,
  });

  return buildOnboardingSummary(stats);
}

export async function getAdminOnboardingAnalytics(
  now = new Date(),
): Promise<OnboardingAnalytics> {
  const [users, citationRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastSeenAt: true,
        memberships: {
          select: {
            organization: {
              select: {
                id: true,
                plan: true,
                brands: {
                  orderBy: { createdAt: "desc" },
                  select: {
                    id: true,
                    name: true,
                    recurringScanActive: true,
                    recurringScanNextRunAt: true,
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
                      select: {
                        id: true,
                        brandId: true,
                        status: true,
                        triggerType: true,
                        createdAt: true,
                      },
                    },
                    recommendations: {
                      where: { status: { in: ["in_progress", "done"] } },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.$queryRaw<CitationCountRow[]>`
      SELECT m."userId" AS user_id, COUNT(DISTINCT c.id) AS citation_count
      FROM "Membership" m
      JOIN "Organization" o ON o.id = m."organizationId"
      JOIN "Brand" b ON b."organizationId" = o.id
      JOIN "ScanRun" sr ON sr."brandId" = b.id
      JOIN "PromptRun" pr ON pr."scanRunId" = sr.id
      JOIN "AiResponse" ar ON ar."promptRunId" = pr.id
      JOIN "Citation" c ON c."aiResponseId" = ar.id
      WHERE o."plan" <> 'disabled'
      GROUP BY m."userId"
    `,
  ]);
  const citationsByUserId = new Map(
    citationRows.map((row) => [row.user_id, Number(row.citation_count)]),
  );

  const analyticsUsers = users.map((user) => {
    const activeOrganizations = user.memberships
      .map((membership) => membership.organization)
      .filter((organization) => organization.plan !== "disabled");
    const brands = activeOrganizations.flatMap(
      (organization) => organization.brands,
    );
    const completedScans = brands.flatMap((brand) =>
      brand.scanRuns.filter((scan) => scan.status === "completed"),
    );
    const latestScan = completedScans.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0];
    const primaryBrand =
      brands.find((brand) => brand.id === latestScan?.brandId) ?? brands[0];

    return statsFromUserBrands({
      user,
      activeOrganizations,
      brands,
      citationCount: citationsByUserId.get(user.id) ?? 0,
      completedScanCount: completedScans.length,
      manualCompletedScanCount: completedScans.filter(
        (scan) => scan.triggerType === "manual",
      ).length,
      latestScan: latestScan
        ? {
            id: latestScan.id,
            brandId: latestScan.brandId,
            createdAt: latestScan.createdAt,
          }
        : null,
      primaryBrand,
    });
  });

  return summarizeOnboardingAnalytics(analyticsUsers, now);
}

export function buildOnboardingSummary(
  stats: OnboardingUsageStats,
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
    nextStep: steps.find((step) => !step.completed) ?? null,
  };
}

export function buildOnboardingSteps(
  stats: OnboardingUsageStats,
): OnboardingStep[] {
  const hasBrand = stats.brandCount > 0;
  const hasCompletedScan = stats.completedScanCount > 0;
  const brandHref = stats.primaryBrandId
    ? `/app/brands/${stats.primaryBrandId}`
    : "/ai-visibility-checker";
  const scanHref =
    stats.latestScanId && stats.latestScanBrandId
      ? `/app/brands/${stats.latestScanBrandId}/scans/${stats.latestScanId}`
      : brandHref;
  const promptHref = stats.primaryBrandId
    ? `/app/brands/${stats.primaryBrandId}/prompts`
    : "/ai-visibility-checker";
  const competitorsHref = stats.primaryBrandId
    ? `/app/brands/${stats.primaryBrandId}/competitors`
    : "/ai-visibility-checker";
  const citationsHref = stats.primaryBrandId
    ? `/app/brands/${stats.primaryBrandId}/citations`
    : "/ai-visibility-checker";
  const actionsHref = stats.primaryBrandId
    ? `/app/brands/${stats.primaryBrandId}/actions`
    : "/ai-visibility-checker";
  const habitComplete =
    stats.completedScanCount >= 2 ||
    (stats.recurringActiveCount > 0 && stats.scheduledScanCount > 0);

  return [
    {
      key: "create_brand",
      title: "Track your first brand",
      description:
        "Create a brand profile so Radar can connect prompts, competitors, scans and sources.",
      cta: hasBrand ? "Open brand" : "Add brand",
      href: brandHref,
      completed: hasBrand,
      locked: false,
      metric: `${stats.brandCount}/${Math.max(1, stats.brandCount)} brands`,
    },
    {
      key: "first_scan",
      title: "Review the first AI scan",
      description:
        "Open the latest scan to see model answers, ranks, mentions and evidence.",
      cta: hasCompletedScan ? "Open latest scan" : "Open brand",
      href: scanHref,
      completed: hasCompletedScan,
      locked: !hasBrand,
      metric: `${stats.completedScanCount} completed scans`,
    },
    {
      key: "prompt_depth",
      title: `Reach ${PROMPT_DEPTH_TARGET} active buyer questions`,
      description:
        "Broader prompts expose more buying moments and make trend data more useful.",
      cta: "Improve prompts",
      href: promptHref,
      completed: stats.activePromptCount >= PROMPT_DEPTH_TARGET,
      locked: !hasBrand,
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
      locked: !hasBrand,
      metric: `${stats.competitorCount}/${COMPETITOR_TARGET} competitors`,
    },
    {
      key: "source_intelligence",
      title: "Inspect cited sources",
      description:
        "Source review shows which domains AI models trust for your category.",
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
        "Use content reviews or recommendation statuses to turn scan output into action.",
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
        "Repeated scans make movement visible and keep weekly monitoring alive.",
      cta: "Open dashboard",
      href: "/app/dashboard",
      completed: habitComplete,
      locked: !hasBrand,
      metric:
        stats.recurringActiveCount > 0
          ? `${stats.recurringActiveCount} recurring schedules`
          : `${stats.completedScanCount}/2 completed scans`,
    },
  ];
}

export function summarizeOnboardingAnalytics(
  users: OnboardingAnalyticsUser[],
  now = new Date(),
): OnboardingAnalytics {
  const recentlyActiveCutoff = addDays(now, -7);
  const activatedUsers = users.filter(isActivatedUser).length;
  const deepUsers = users.filter(isDeepUser).length;
  const repeatUsers = users.filter(isRepeatUser).length;
  const recentlyActiveUsers = users.filter(
    (user) => user.lastSeenAt && user.lastSeenAt >= recentlyActiveCutoff,
  ).length;
  const atRiskUsers = users.filter((user) => isAtRiskUser(user, now)).length;
  const funnel = buildFunnel(users);
  const cohorts = buildSignupCohorts(users, now, COHORT_COUNT);
  const usersNeedingHelp = users
    .map((user) => {
      const summary = buildOnboardingSummary(user);
      return {
        ...user,
        nextStep: summary.nextStep,
        completionPercent: summary.completionPercent,
      };
    })
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

function statsFromUserBrands(input: {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    lastSeenAt: Date | null;
  };
  activeOrganizations: Array<{
    id: string;
    plan: string;
  }>;
  brands: Array<{
    id: string;
    name: string;
    recurringScanActive: boolean;
    recurringScanNextRunAt: Date | null;
    _count: {
      competitors: number;
      promptContentReviews: number;
    };
    promptSets: Array<{
      prompts: Array<{ id: string }>;
    }>;
    recommendations: Array<{ id: string }>;
  }>;
  citationCount: number;
  completedScanCount: number;
  manualCompletedScanCount: number;
  latestScan?: {
    id: string;
    brandId: string;
    createdAt: Date;
  } | null;
  primaryBrand?: { id: string; name: string } | null;
}): OnboardingAnalyticsUser {
  return {
    userId: input.user.id,
    email: input.user.email,
    name: input.user.name,
    createdAt: input.user.createdAt,
    lastSeenAt: input.user.lastSeenAt,
    organizationCount: input.activeOrganizations.length,
    brandCount: input.brands.length,
    primaryBrandId: input.primaryBrand?.id,
    primaryBrandName: input.primaryBrand?.name,
    latestScanId: input.latestScan?.id,
    latestScanBrandId: input.latestScan?.brandId,
    latestScanAt: input.latestScan?.createdAt,
    activePromptCount: input.brands.reduce(
      (sum, brand) =>
        sum +
        brand.promptSets.reduce(
          (promptSum, promptSet) => promptSum + promptSet.prompts.length,
          0,
        ),
      0,
    ),
    competitorCount: input.brands.reduce(
      (sum, brand) => sum + brand._count.competitors,
      0,
    ),
    completedScanCount: input.completedScanCount,
    manualCompletedScanCount: input.manualCompletedScanCount,
    citationCount: input.citationCount,
    contentReviewCount: input.brands.reduce(
      (sum, brand) => sum + brand._count.promptContentReviews,
      0,
    ),
    touchedRecommendationCount: input.brands.reduce(
      (sum, brand) => sum + brand.recommendations.length,
      0,
    ),
    recurringActiveCount: input.brands.filter(
      (brand) => brand.recurringScanActive,
    ).length,
    scheduledScanCount: input.brands.filter(
      (brand) => brand.recurringScanActive && brand.recurringScanNextRunAt,
    ).length,
    manualScanAccess: input.activeOrganizations.some(
      (organization) =>
        organization.plan === "starter" || organization.plan === "growth",
    ),
  };
}

function buildFunnel(users: OnboardingAnalyticsUser[]): OnboardingFunnelStep[] {
  const steps = [
    {
      key: "signed_up",
      label: "Signed up",
      count: users.length,
    },
    {
      key: "active_account",
      label: "Active account",
      count: users.filter((user) => user.organizationCount > 0).length,
    },
    {
      key: "brand_created",
      label: "Created a brand",
      count: users.filter((user) => user.brandCount > 0).length,
    },
    {
      key: "first_scan",
      label: "Completed first scan",
      count: users.filter((user) => user.completedScanCount > 0).length,
    },
    {
      key: "prompt_depth",
      label: `${PROMPT_DEPTH_TARGET}+ active prompts`,
      count: users.filter(
        (user) => user.activePromptCount >= PROMPT_DEPTH_TARGET,
      ).length,
    },
    {
      key: "competitors",
      label: `${COMPETITOR_TARGET}+ competitors`,
      count: users.filter((user) => user.competitorCount >= COMPETITOR_TARGET)
        .length,
    },
    {
      key: "improvement_loop",
      label: "Started improvement loop",
      count: users.filter(
        (user) =>
          user.contentReviewCount > 0 || user.touchedRecommendationCount > 0,
      ).length,
    },
    {
      key: "repeat_scans",
      label: "Repeated measurement",
      count: users.filter(isRepeatUser).length,
    },
  ];

  return steps.map((step) => ({
    ...step,
    conversionPercent: percent(step.count, users.length),
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

function isActivatedUser(user: OnboardingUsageStats) {
  return user.brandCount > 0 && user.completedScanCount > 0;
}

function isDeepUser(user: OnboardingUsageStats) {
  return (
    isActivatedUser(user) &&
    user.activePromptCount >= PROMPT_DEPTH_TARGET &&
    user.competitorCount >= COMPETITOR_TARGET
  );
}

function isRepeatUser(user: OnboardingUsageStats) {
  return user.completedScanCount >= 2 || user.scheduledScanCount > 0;
}

function isAtRiskUser(user: OnboardingAnalyticsUser, now: Date) {
  const staleCutoff = addDays(now, -14);
  return (
    user.brandCount === 0 ||
    (user.brandCount > 0 && user.completedScanCount === 0) ||
    (isActivatedUser(user) &&
      (!user.lastSeenAt || user.lastSeenAt < staleCutoff) &&
      user.completedScanCount < 2)
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
