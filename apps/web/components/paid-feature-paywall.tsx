import { Check, LockKeyhole } from "lucide-react";
import { PaywallCheckoutActions } from "@/components/paywall-checkout-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paidFeatureLabels, type PaidFeatureKey } from "@/lib/billing";

export function PaidFeaturePaywall({
  brandId,
  organizationId,
  feature
}: {
  brandId: string;
  organizationId: string;
  feature: PaidFeatureKey;
}) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <LockKeyhole className="h-4 w-4" />
          Plačljiv modul
        </div>
        <CardTitle>{paidFeatureLabels[feature]} so vključeni v plačljive pakete</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ta zavihek je namenjen rednemu delu z rezultati: spremljanju konkurentov, citiranih virov in konkretnih nalog.
          Za dostop aktiviraj naročnino Starter ali Growth.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <PlanCard
            name="Starter"
            price="15,99 € / mesec"
            badge="tedensko"
            items={["1 znamka", "25 promptov", "Tedenski reden scan", "Konkurenti, citati in akcijski center"]}
          />
          <PlanCard
            name="Growth"
            price="39,99 € / mesec"
            badge="dnevno"
            items={["3 znamke", "100 promptov na znamko", "Dnevni reden scan", "Več prostora za rast in primerjave"]}
          />
        </div>
        <PaywallCheckoutActions organizationId={organizationId} brandId={brandId} feature={feature} />
      </CardContent>
    </Card>
  );
}

function PlanCard({
  name,
  price,
  badge,
  items
}: {
  name: string;
  price: string;
  badge: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{name}</div>
          <div className="text-sm text-muted-foreground">{price}</div>
        </div>
        <Badge>{badge}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
