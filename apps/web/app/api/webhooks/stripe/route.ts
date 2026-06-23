import Stripe from "stripe";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { fail, ok, route } from "@/lib/http";
import { activateRecurringScanForBrand, type PaidPlan } from "@/lib/services";

type BillingStatusValue =
  | "incomplete"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete_expired"
  | "paused";

type SubscriptionFallback = {
  organizationId?: string;
  plan?: string;
  brandId?: string;
  intent?: string;
  customerId?: string;
};

export async function POST(request: Request) {
  return route(async () => {
    const config = getConfig();
    if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
      return fail("Stripe webhook is not configured", 500);
    }
    const stripe = new Stripe(config.STRIPE_SECRET_KEY);
    const signature = request.headers.get("stripe-signature");
    if (!signature) return fail("Missing stripe-signature", 400);
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const fallback: SubscriptionFallback = {
        organizationId: session.metadata?.organizationId,
        plan: session.metadata?.plan,
        brandId: session.metadata?.brandId,
        intent: session.metadata?.intent,
        customerId:
          typeof session.customer === "string" ? session.customer : undefined,
      };

      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription,
        );
        await syncStripeSubscription(subscription, fallback);
      } else {
        await syncCheckoutWithoutSubscription(fallback);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
    }

    return ok({ received: true });
  });
}

async function syncCheckoutWithoutSubscription(fallback: SubscriptionFallback) {
  const plan = paidPlan(fallback.plan);
  if (!fallback.organizationId || !plan) return;

  await prisma.organization.update({
    where: { id: fallback.organizationId },
    data: {
      plan,
      stripeCustomerId: fallback.customerId,
      billingSubscription: {
        upsert: {
          create: {
            plan,
            status: "incomplete",
          },
          update: {
            plan,
            status: "incomplete",
          },
        },
      },
    },
  });
}

async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  fallback: SubscriptionFallback = {},
) {
  const existing = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { organization: true },
  });
  const priceId = subscription.items.data[0]?.price.id;
  const organizationId =
    subscription.metadata.organizationId ??
    fallback.organizationId ??
    existing?.organizationId;
  const plan =
    paidPlan(subscription.metadata.plan) ??
    paidPlan(fallback.plan) ??
    planFromPriceId(priceId);
  if (!organizationId || !plan) return;

  const status = billingStatusFromStripe(subscription.status);
  const paidStatus = status === "active" || status === "trialing";
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (fallback.customerId ??
        existing?.organization.stripeCustomerId ??
        undefined);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: paidStatus ? plan : "free",
      stripeCustomerId: customerId,
      billingSubscription: {
        upsert: {
          create: {
            plan,
            status,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            currentPeriodEnd: currentPeriodEnd(subscription),
          },
          update: {
            plan,
            status,
            stripePriceId: priceId,
            currentPeriodEnd: currentPeriodEnd(subscription),
          },
        },
      },
    },
  });

  const brandId = subscription.metadata.brandId ?? fallback.brandId;
  const intent = subscription.metadata.intent ?? fallback.intent;
  if (paidStatus && intent === "regular_scan" && brandId) {
    await activateRecurringScanForBrand(brandId, plan);
  }

  if (!paidStatus) {
    await prisma.brand.updateMany({
      where: { organizationId },
      data: {
        recurringScanActive: false,
        recurringScanNextRunAt: null,
      },
    });
  }
}

function paidPlan(value: string | null | undefined): PaidPlan | null {
  if (value === "starter" || value === "growth") return value;
  return null;
}

function planFromPriceId(priceId: string | undefined): PaidPlan | null {
  const config = getConfig();
  if (priceId && priceId === config.STRIPE_STARTER_PRICE_ID) return "starter";
  if (priceId && priceId === config.STRIPE_GROWTH_PRICE_ID) return "growth";
  return null;
}

function billingStatusFromStripe(
  status: Stripe.Subscription.Status,
): BillingStatusValue {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return status;
    case "paused":
      return "paused";
    default:
      return "incomplete";
  }
}

function currentPeriodEnd(subscription: Stripe.Subscription) {
  return subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : undefined;
}
