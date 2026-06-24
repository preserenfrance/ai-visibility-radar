"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Plan = "free" | "starter" | "growth";

export function RegularScanControls({
  brandId,
  organizationId,
  organizationPlan,
  hasStripeCustomer,
}: {
  brandId: string;
  organizationId: string;
  organizationPlan: Plan;
  hasStripeCustomer: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const automaticScanAccess =
    organizationPlan === "free" ||
    organizationPlan === "starter" ||
    organizationPlan === "growth";
  const planLabel =
    organizationPlan === "growth"
      ? "Growth"
      : organizationPlan === "starter"
        ? "Starter"
        : "Brezplačni";

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Dejanja trenutno ni bilo mogoče izvesti.",
        );
      }
    });
  }

  async function startCheckout() {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        brandId,
        intent: "regular_scan",
        plan: "starter",
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { url?: string };
    if (!data.url)
      throw new Error("Stripe checkout ni vrnil povezave za plačilo.");
    window.location.href = data.url;
  }

  async function openPortal() {
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { url?: string };
    if (!data.url) throw new Error("Stripe portal ni vrnil povezave.");
    window.location.href = data.url;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {automaticScanAccess ? (
        hasStripeCustomer ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(openPortal)}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Plačilo
          </Button>
        ) : (
          <span className="rounded-md border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">
            {planLabel} aktiven
          </span>
        )
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run(startCheckout)}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="h-4 w-4" />
          )}
          Odpri nastavitve
        </Button>
      )}
      {error && (
        <div className="basis-full text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error ?? "Prišlo je do napake.";
}
