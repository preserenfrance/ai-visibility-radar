import { describe, expect, it } from "vitest";
import {
  buildOnboardingSummary,
  buildUserOnboardingLevel,
  summarizeOnboardingAnalytics,
  type BrandOnboardingStats,
  type OnboardingAnalyticsUser,
  type OnboardingSummary,
} from "@/lib/onboarding";

const baseStats: BrandOnboardingStats = {
  brandId: "brand_1",
  brandName: "Acme",
  organizationId: "org_1",
  activePromptCount: 0,
  competitorCount: 0,
  completedScanCount: 0,
  manualCompletedScanCount: 0,
  citationCount: 0,
  contentReviewCount: 0,
  touchedRecommendationCount: 0,
  recurringActive: false,
  scheduledScan: false,
  manualScanAccess: false,
};

describe("brand onboarding summary", () => {
  it("starts with the first scan step for an existing brand", () => {
    const summary = buildOnboardingSummary(baseStats);

    expect(summary.completionPercent).toBe(0);
    expect(summary.nextStep?.key).toBe("first_scan");
    expect(summary.steps.map((step) => step.key as string)).not.toContain(
      "create_brand",
    );
    expect(
      summary.steps.find((step) => step.key === "source_intelligence")?.locked,
    ).toBe(true);
  });

  it("marks a mature brand as fully complete", () => {
    const summary = buildOnboardingSummary({
      ...baseStats,
      activePromptCount: 9,
      competitorCount: 3,
      completedScanCount: 2,
      manualCompletedScanCount: 1,
      latestScanId: "scan_1",
      citationCount: 4,
      contentReviewCount: 1,
      recurringActive: true,
      scheduledScan: true,
      manualScanAccess: true,
    });

    expect(summary.completionPercent).toBe(100);
    expect(summary.nextStep).toBeNull();
  });
});

describe("user onboarding level", () => {
  it("aggregates onboarding level across a user's brands", () => {
    const level = buildUserOnboardingLevel("u1", [
      completedSummary("brand_1"),
      buildOnboardingSummary({
        ...baseStats,
        brandId: "brand_2",
        brandName: "Beta",
        completedScanCount: 1,
        activePromptCount: 8,
        competitorCount: 2,
        citationCount: 1,
      }),
    ]);

    expect(level.totalBrands).toBe(2);
    expect(level.completedBrands).toBe(1);
    expect(level.level.key).toBe("advanced");
    expect(level.weakestBrand?.brandId).toBe("brand_2");
  });
});

describe("onboarding analytics", () => {
  it("builds activation, depth and repeat rates from brand summaries", () => {
    const users: OnboardingAnalyticsUser[] = [
      user("u1", [completedSummary("brand_1")]),
      user("u2", [
        buildOnboardingSummary({
          ...baseStats,
          brandId: "brand_2",
          brandName: "Beta",
          completedScanCount: 1,
          activePromptCount: 4,
        }),
      ]),
      user("u3", []),
    ];

    const analytics = summarizeOnboardingAnalytics(
      users,
      new Date("2026-08-21T12:00:00.000Z"),
    );

    expect(analytics.activationRate).toBe(67);
    expect(analytics.deepUsageRate).toBe(33);
    expect(analytics.repeatRate).toBe(33);
    expect(
      analytics.funnel.find((step) => step.key === "first_scan")
        ?.conversionPercent,
    ).toBe(100);
  });
});

function completedSummary(brandId: string): OnboardingSummary {
  return buildOnboardingSummary({
    ...baseStats,
    brandId,
    brandName: brandId,
    activePromptCount: 8,
    competitorCount: 2,
    completedScanCount: 2,
    citationCount: 1,
    contentReviewCount: 1,
    recurringActive: true,
    scheduledScan: true,
  });
}

function user(
  userId: string,
  summaries: OnboardingSummary[],
): OnboardingAnalyticsUser {
  return {
    ...buildUserOnboardingLevel(userId, summaries),
    email: `${userId}@example.com`,
    name: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    lastSeenAt: new Date("2026-08-21T00:00:00.000Z"),
    brandSummaries: summaries,
  };
}
