import type { Plan } from "@ai-radar/shared";

export type UsageSnapshot = {
  brandCount: number;
  promptsPerBrand: number;
  scansThisMonth: number;
  aiCallsThisMonth: number;
};

export type UsageCheck = {
  allowed: boolean;
  reason?: string;
};

export const PLAN_LIMITS: Record<
  Plan,
  {
    brandCount: number;
    promptsPerBrand: number;
    scansPerMonth: number;
    aiCallsPerMonth: number;
    scanCadence: "none" | "manual" | "weekly";
  }
> = {
  free: {
    brandCount: 1,
    promptsPerBrand: 10,
    scansPerMonth: 0,
    aiCallsPerMonth: 0,
    scanCadence: "none",
  },
  starter: {
    brandCount: 1,
    promptsPerBrand: 25,
    scansPerMonth: 8,
    aiCallsPerMonth: 600,
    scanCadence: "manual",
  },
  growth: {
    brandCount: 3,
    promptsPerBrand: 100,
    scansPerMonth: 90,
    aiCallsPerMonth: 9000,
    scanCadence: "weekly",
  },
};

export function checkUsageGuard(plan: Plan, usage: UsageSnapshot): UsageCheck {
  const limits = PLAN_LIMITS[plan];

  if (usage.brandCount > limits.brandCount) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.brandCount} brand(s).`,
    };
  }

  if (usage.promptsPerBrand > limits.promptsPerBrand) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.promptsPerBrand} prompts per brand.`,
    };
  }

  if (
    limits.scansPerMonth === 0
      ? usage.scansThisMonth > 0
      : usage.scansThisMonth >= limits.scansPerMonth
  ) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.scansPerMonth} scans per month.`,
    };
  }

  if (
    limits.aiCallsPerMonth === 0
      ? usage.aiCallsThisMonth > 0
      : usage.aiCallsThisMonth >= limits.aiCallsPerMonth
  ) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.aiCallsPerMonth} AI calls per month.`,
    };
  }

  return { allowed: true };
}
