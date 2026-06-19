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
    scanCadence: "manual" | "weekly" | "daily";
  }
> = {
  free: {
    brandCount: 1,
    promptsPerBrand: 10,
    scansPerMonth: 1,
    aiCallsPerMonth: 15,
    scanCadence: "manual"
  },
  starter: {
    brandCount: 1,
    promptsPerBrand: 25,
    scansPerMonth: 8,
    aiCallsPerMonth: 600,
    scanCadence: "weekly"
  },
  growth: {
    brandCount: 3,
    promptsPerBrand: 100,
    scansPerMonth: 90,
    aiCallsPerMonth: 9000,
    scanCadence: "daily"
  }
};

export function checkUsageGuard(plan: Plan, usage: UsageSnapshot): UsageCheck {
  const limits = PLAN_LIMITS[plan];

  if (usage.brandCount > limits.brandCount) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.brandCount} brand(s).`
    };
  }

  if (usage.promptsPerBrand > limits.promptsPerBrand) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.promptsPerBrand} prompts per brand.`
    };
  }

  if (usage.scansThisMonth >= limits.scansPerMonth) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.scansPerMonth} scans per month.`
    };
  }

  if (usage.aiCallsThisMonth >= limits.aiCallsPerMonth) {
    return {
      allowed: false,
      reason: `Plan ${plan} allows ${limits.aiCallsPerMonth} AI calls per month.`
    };
  }

  return { allowed: true };
}
