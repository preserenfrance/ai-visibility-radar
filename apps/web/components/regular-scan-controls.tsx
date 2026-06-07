"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CreditCard, Loader2, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Plan = "free" | "starter" | "growth";

export function RegularScanControls({
  brandId,
  organizationId,
  organizationPlan,
  billingStatus,
  recurringScanActive,
  hasStripeCustomer
}: {
  brandId: string;
  organizationId: string;
  organizationPlan: Plan;
  billingStatus?: string | null;
  recurringScanActive: boolean;
  hasStripeCustomer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paidAndActive =
    organizationPlan !== "free" && (billingStatus === "active" || billingStatus === "trialing");

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Dejanja trenutno ni bilo mogoče izvesti.");
      }
    });
  }

  async function activate() {
    if (!paidAndActive) {
      await startCheckout();
      return;
    }

    const response = await fetch(`/api/brands/${brandId}/recurring-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate" })
    });
    if (!response.ok) throw new Error(await responseError(response));
    router.refresh();
  }

  async function deactivate() {
    const response = await fetch(`/api/brands/${brandId}/recurring-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate" })
    });
    if (!response.ok) throw new Error(await responseError(response));
    router.refresh();
  }

  async function startCheckout() {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        brandId,
        intent: "regular_scan",
        plan: organizationPlan === "growth" ? "growth" : "starter"
      })
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe checkout ni vrnil povezave za plačilo.");
    window.location.href = data.url;
  }

  async function openPortal() {
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId })
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe portal ni vrnil povezave.");
    window.location.href = data.url;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {recurringScanActive ? (
        <>
          <Button type="button" size="sm" variant="outline" disabled={isPending || !hasStripeCustomer} onClick={() => run(openPortal)}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Plačilo
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => run(deactivate)}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
            Izklopi
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" disabled={isPending} onClick={() => run(activate)}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          Aktiviraj reden scan
        </Button>
      )}
      {error && <div className="basis-full text-xs text-destructive">{error}</div>}
    </div>
  );
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Prišlo je do napake.";
}
