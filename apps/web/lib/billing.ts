import type { Plan } from "@ai-radar/shared";
import { PLAN_LIMITS } from "@ai-radar/usage";

export type PaidFeatureKey = "competitors" | "citations" | "actions";

type OrganizationPlanAccess = {
  plan: Plan;
  billingSubscription?: {
    status: string | null;
    stripeSubscriptionId?: string | null;
  } | null;
};

export const paidFeatureLabels: Record<PaidFeatureKey, string> = {
  competitors: "Konkurenti",
  citations: "Citati",
  actions: "Ideje za izboljšanje",
};

export function hasActivePaidPlan(organization: OrganizationPlanAccess) {
  // Organization.plan is the access source of truth; Stripe status is billing metadata.
  return organization.plan !== "free";
}

export function effectivePlanForOrganization(
  organization: OrganizationPlanAccess,
): Plan {
  return hasActivePaidPlan(organization) ? organization.plan : "free";
}

export function promptLimitForOrganization(
  organization: OrganizationPlanAccess,
) {
  return PLAN_LIMITS[effectivePlanForOrganization(organization)]
    .promptsPerBrand;
}

export function paidFeatureFromValue(
  value: string | string[] | undefined,
): PaidFeatureKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "competitors" || raw === "citations" || raw === "actions")
    return raw;
  return "competitors";
}
