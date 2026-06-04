import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { requireOrganizationAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  organizationId: z.string(),
  plan: z.enum(["starter", "growth"])
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const { user } = await requireOrganizationAccess(input.organizationId);
    const config = getConfig();
    if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required");
    const priceId = input.plan === "starter" ? config.STRIPE_STARTER_PRICE_ID : config.STRIPE_GROWTH_PRICE_ID;
    if (!priceId) throw new Error(`Missing Stripe price id for ${input.plan}`);

    const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!organization) throw new Error("Organization not found");
    const stripe = new Stripe(config.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: organization.stripeCustomerId ?? undefined,
      customer_email: organization.stripeCustomerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.NEXT_PUBLIC_APP_URL}/app/settings?billing=success`,
      cancel_url: `${config.NEXT_PUBLIC_APP_URL}/pricing?billing=canceled`,
      metadata: {
        organizationId: input.organizationId,
        plan: input.plan
      }
    });
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: user.id,
        action: "billing_checkout_started"
      }
    });
    return ok({ url: session.url });
  });
}
