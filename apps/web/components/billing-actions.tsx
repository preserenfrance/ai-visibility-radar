"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/analytics-events";
import { Button } from "@/components/ui/button";

type PaidPlan = "starter" | "growth";

export function BillingActions({
  organizationId,
  hasStripeCustomer,
  disabled = false,
}: {
  organizationId: string;
  hasStripeCustomer: boolean;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Billing could not be opened right now.",
        );
      }
    });
  }

  async function startCheckout(plan: PaidPlan) {
    trackAnalyticsEvent("upgrade_plan_click", {
      location: "settings_billing",
      plan,
      has_stripe_customer: hasStripeCustomer,
    });

    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, plan, intent: "plan_upgrade" }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { url?: string };
    if (!data.url)
      throw new Error("Stripe checkout did not return a payment link.");
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
    if (!data.url) throw new Error("Stripe portal did not return a link.");
    window.location.href = data.url;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {disabled ? (
        <span className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          Account is disabled
        </span>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => startCheckout("starter"))}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Starter
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => startCheckout("growth"))}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Growth
          </Button>
          {hasStripeCustomer && (
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => run(openPortal)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Portal
            </Button>
          )}
        </>
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
  return data?.error ?? "Something went wrong.";
}
