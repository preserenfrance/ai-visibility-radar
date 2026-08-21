import { describe, expect, it } from "vitest";
import {
  buildOnboardingSummary,
  summarizeOnboardingAnalytics,
  type OnboardingAnalyticsUser,
  type OnboardingUsageStats,
} from "@/lib/onboarding";

const baseStats: OnboardingUsageStats = {
  organizationCount: 1,
  brandCount: 0,
  activePromptCount: 0,
  competitorCount: 0,
  completedScanCount: 0,
  manualCompletedScanCount: 0,
  citationCount: 0,
  contentReviewCount: 0,
  touchedRecommendationCount: 0,
  recurringActiveCount: 0,
  scheduledScanCount: 0,
  manualScanAccess: false,
};

describe("onboarding summary", () => {
  it("starts with the brand creation step", () => {
    const summary = buildOnboardingSummary(baseStats);

    expect(summary.completionPercent).toBe(0);
    expect(summary.nextStep?.key).toBe("create_brand");
    expect(
      summary.steps.find((step) => step.key === "first_scan")?.locked,
    ).toBe(true);
  });

  it("marks a mature account as fully complete", () => {
    const summary = buildOnboardingSummary({
      ...baseStats,
      brandCount: 1,
      primaryBrandId: "brand_1",
      activePromptCount: 9,
      competitorCount: 3,
      completedScanCount: 2,
      manualCompletedScanCount: 1,
      latestScanId: "scan_1",
      latestScanBrandId: "brand_1",
      citationCount: 4,
      contentReviewCount: 1,
      recurringActiveCount: 1,
      scheduledScanCount: 1,
      manualScanAccess: true,
    });

    expect(summary.completionPercent).toBe(100);
    expect(summary.nextStep).toBeNull();
  });
});

describe("onboarding analytics", () => {
  it("builds activation, depth and repeat rates", () => {
    const users: OnboardingAnalyticsUser[] = [
      user("u1", {
        brandCount: 1,
        activePromptCount: 8,
        competitorCount: 2,
        completedScanCount: 2,
        scheduledScanCount: 1,
      }),
      user("u2", {
        brandCount: 1,
        activePromptCount: 4,
        competitorCount: 0,
        completedScanCount: 1,
      }),
      user("u3", {}),
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
    ).toBe(67);
  });
});

function user(
  userId: string,
  overrides: Partial<OnboardingAnalyticsUser>,
): OnboardingAnalyticsUser {
  return {
    ...baseStats,
    userId,
    email: `${userId}@example.com`,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    lastSeenAt: new Date("2026-08-21T00:00:00.000Z"),
    ...overrides,
  };
}
