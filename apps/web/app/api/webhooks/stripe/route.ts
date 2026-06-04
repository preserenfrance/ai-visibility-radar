import Stripe from "stripe";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { fail, ok, route } from "@/lib/http";

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
    const event = stripe.webhooks.constructEvent(payload, signature, config.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      const plan = session.metadata?.plan as "starter" | "growth" | undefined;
      if (organizationId && plan) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            plan,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            billingSubscription: {
              upsert: {
                create: {
                  plan,
                  status: "active",
                  stripeSubscriptionId:
                    typeof session.subscription === "string" ? session.subscription : undefined
                },
                update: {
                  plan,
                  status: "active",
                  stripeSubscriptionId:
                    typeof session.subscription === "string" ? session.subscription : undefined
                }
              }
            }
          }
        });
      }
    }

    return ok({ received: true });
  });
}
