import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  { name: "Brezplačno", price: "0", items: ["1 brezplačen audit", "10 promptov", "Ročni AI scan"] },
  { name: "Starter", price: "15,99", items: ["1 znamka", "25 promptov", "Tedenski reden scan", "Stripe naročnina"] },
  { name: "Growth", price: "39,99", items: ["3 znamke", "100 promptov na znamko", "Dnevni reden scan", "Akcijski center"] }
];

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Cenik</h1>
          <p className="text-muted-foreground">Plačljivi paketi vključujejo samodejne redne scane in Stripe upravljanje naročnine.</p>
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
              <div className="text-3xl font-semibold">{plan.price} €</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.items.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {item}
                </div>
              ))}
              <Button asChild className="w-full" variant={plan.name === "Brezplačno" ? "outline" : "default"}>
                <Link href={plan.name === "Brezplačno" ? "/ai-visibility-checker" : "/app/settings"}>
                  {plan.name === "Brezplačno" ? "Začni brezplačen audit" : "Izberi paket"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
