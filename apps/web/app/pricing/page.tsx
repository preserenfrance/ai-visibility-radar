import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  { name: "Free", price: "0", items: ["1 free audit", "5 promptov", "Mock provider scan"] },
  { name: "Starter", price: "49", items: ["1 brand", "25 promptov", "Tedenski scan", "Stripe checkout"] },
  { name: "Growth", price: "149", items: ["3 brandi", "100 promptov na brand", "Dnevni scan", "Action Center"] }
];

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Pricing</h1>
          <p className="text-muted-foreground">Pripravljena je billing osnova za Starter in Growth.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Domov</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="text-3xl font-semibold">€{plan.price}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.items.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {item}
                </div>
              ))}
              <Button asChild className="w-full" variant={plan.name === "Free" ? "outline" : "default"}>
                <Link href={plan.name === "Free" ? "/ai-visibility-checker" : "/app/settings"}>
                  {plan.name === "Free" ? "Začni free audit" : "Izberi plan"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
