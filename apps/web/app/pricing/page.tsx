import Link from "next/link";
import { Check } from "lucide-react";
import { TrackedAnchor } from "@/components/analytics-events";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n";

type PlanId = "free" | "starter" | "growth";
type FeatureValue = boolean | string | number;

export default async function PricingPage() {
  const { dictionary } = await getI18n();
  const pricing = dictionary.pricing;
  const plans: Array<{
    id: PlanId;
    name: string;
    price: string;
    href: string;
    cta: string;
  }> = [
    { id: "free", href: "/ai-visibility-checker", ...pricing.plans.free },
    { id: "starter", href: "/app/settings", ...pricing.plans.starter },
    { id: "growth", href: "/app/settings", ...pricing.plans.growth },
  ];
  const features = pricing.features.map(([label, values]) => ({
    label,
    values,
  }));

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{pricing.title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {pricing.intro}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">{pricing.home}</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-secondary/40">
                <th className="w-[34%] px-4 py-4 text-left font-semibold">
                  {pricing.feature}
                </th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-4 py-4 text-left align-top">
                    <div className="text-lg font-semibold">{plan.name}</div>
                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                      {plan.price}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.label} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{feature.label}</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="px-4 py-3">
                      <FeatureCell
                        value={feature.values[plan.id]}
                        includedLabel={pricing.included}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-secondary/20">
                <td className="px-4 py-4 font-medium">{pricing.start}</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-4">
                    <Button
                      asChild
                      className="w-full"
                      variant={plan.id === "free" ? "outline" : "default"}
                    >
                      <TrackedAnchor
                        href={plan.href}
                        eventName={
                          plan.id === "free"
                            ? "free_audit_cta_click"
                            : "upgrade_plan_click"
                        }
                        eventProperties={{
                          location: "pricing",
                          plan: plan.id,
                        }}
                      >
                        {plan.cta}
                      </TrackedAnchor>
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function FeatureCell({
  value,
  includedLabel,
}: {
  value: FeatureValue;
  includedLabel: string;
}) {
  if (value === true) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
        <Check className="h-4 w-4" aria-label={includedLabel} />
      </span>
    );
  }

  if (value === false) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <span className="font-medium">{value}</span>;
}
