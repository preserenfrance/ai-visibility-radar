import type { Plan } from "@ai-radar/shared";

export type PaidFeatureKey = "competitors" | "citations" | "actions";

export const paidFeatureLabels: Record<PaidFeatureKey, string> = {
  competitors: "Konkurenti",
  citations: "Citati",
  actions: "Akcijski center"
};

export function hasActivePaidPlan(organization: {
  plan: Plan;
  billingSubscription?: { status: string | null } | null;
}) {
  return (
    organization.plan !== "free" &&
    (organization.billingSubscription?.status === "active" || organization.billingSubscription?.status === "trialing")
  );
}

export function paidFeatureFromValue(value: string | string[] | undefined): PaidFeatureKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "competitors" || raw === "citations" || raw === "actions") return raw;
  return "competitors";
}
