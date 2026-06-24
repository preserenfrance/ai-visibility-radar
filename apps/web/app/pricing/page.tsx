import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type PlanId = "free" | "starter" | "growth";
type FeatureValue = boolean | string | number;

const plans: Array<{
  id: PlanId;
  name: string;
  price: string;
  href: string;
  cta: string;
}> = [
  {
    id: "free",
    name: "Brezplačno",
    price: "0 €",
    href: "/ai-visibility-checker",
    cta: "Začni brezplačen audit",
  },
  {
    id: "starter",
    name: "Starter",
    price: "15,99 € / mesec",
    href: "/app/settings",
    cta: "Izberi Starter",
  },
  {
    id: "growth",
    name: "Growth",
    price: "39,99 € / mesec",
    href: "/app/settings",
    cta: "Izberi Growth",
  },
];

const features: Array<{
  label: string;
  values: Record<PlanId, FeatureValue>;
}> = [
  {
    label: "Znamke",
    values: { free: 1, starter: 1, growth: 3 },
  },
  {
    label: "Prompti na znamko",
    values: { free: 10, starter: 25, growth: 100 },
  },
  {
    label: "Scani na mesec",
    values: { free: 1, starter: 8, growth: 90 },
  },
  {
    label: "Reden scan",
    values: { free: false, starter: "tedensko", growth: "dnevno" },
  },
  {
    label: "Pregled pozicij v ChatGPT",
    values: { free: true, starter: true, growth: true },
  },
  {
    label: "Pregled pozicij v Gemini",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Pregled pozicij v Claude",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Pregled pozicij v ChatGPT Search",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Pregled pozicij v Gemini Search",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Pregled pozicij v Claude Search",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Citati in viri iz search modelov",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Konkurenti",
    values: { free: false, starter: true, growth: true },
  },
  {
    label: "Ideje za izboljšanje",
    values: { free: true, starter: true, growth: true },
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Cenik</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Primerjaj pakete po številu znamk, promptih, pogostosti scanov in
            modelih, v katerih meriš pozicije znamke.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Domov</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-secondary/40">
                <th className="w-[34%] px-4 py-4 text-left font-semibold">
                  Funkcionalnost
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
                      <FeatureCell value={feature.values[plan.id]} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-secondary/20">
                <td className="px-4 py-4 font-medium">Začni</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-4">
                    <Button
                      asChild
                      className="w-full"
                      variant={plan.id === "free" ? "outline" : "default"}
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
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

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
        <Check className="h-4 w-4" aria-label="Vključeno" />
      </span>
    );
  }

  if (value === false) {
    return <span className="text-muted-foreground">-</span>;
  }

  return <span className="font-medium">{value}</span>;
}
