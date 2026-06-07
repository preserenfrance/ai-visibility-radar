"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaidFeatureKey } from "@/lib/billing";

type PaidPlan = "starter" | "growth";

export function PaywallCheckoutActions({
  organizationId,
  brandId,
  feature
}: {
  organizationId: string;
  brandId: string;
  feature: PaidFeatureKey;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start(plan: PaidPlan) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            brandId,
            plan,
            intent: "plan_upgrade",
            returnPath: `/app/brands/${brandId}/${feature}`
          })
        });
        if (!response.ok) throw new Error(await responseError(response));
        const data = (await response.json()) as { url?: string };
        if (!data.url) throw new Error("Stripe checkout ni vrnil povezave za plačilo.");
        window.location.href = data.url;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Plačila trenutno ni bilo mogoče odpreti.");
      }
    });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="button" disabled={isPending} onClick={() => start("starter")}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Izberi Starter
      </Button>
      <Button type="button" variant="outline" disabled={isPending} onClick={() => start("growth")}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Izberi Growth
      </Button>
      {error && <div className="text-sm text-destructive sm:col-span-2">{error}</div>}
    </div>
  );
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Prišlo je do napake.";
}
