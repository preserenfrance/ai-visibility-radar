import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { requireOrganizationAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  organizationId: z.string()
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    await requireOrganizationAccess(input.organizationId);
    const config = getConfig();
    if (!config.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required");
    const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!organization?.stripeCustomerId) throw new Error("Stripe customer not found");
    const stripe = new Stripe(config.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${config.NEXT_PUBLIC_APP_URL}/app/settings`
    });
    return ok({ url: session.url });
  });
}
