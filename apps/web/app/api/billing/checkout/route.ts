import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@ai-radar/db";
import { getConfig } from "@ai-radar/config";
import { requireOrganizationAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  organizationId: z.string(),
  plan: z.enum(["starter", "growth"]),
  brandId: z.string().optional(),
  intent: z.enum(["plan_upgrade", "regular_scan"]).default("plan_upgrade"),
  returnPath: z
    .string()
    .regex(/^\/app(\/|\?|$)/)
    .optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const { user } = await requireOrganizationAccess(input.organizationId);
    const config = getConfig();
    if (!config.STRIPE_SECRET_KEY)
      throw new Error("STRIPE_SECRET_KEY is required");
    const checkoutPlan = input.plan;
    const priceId =
      checkoutPlan === "starter"
        ? config.STRIPE_STARTER_PRICE_ID
        : config.STRIPE_GROWTH_PRICE_ID;
    if (!priceId)
      throw new Error(`Missing Stripe price id for ${checkoutPlan}`);

    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
    });
    if (!organization) throw new Error("Organization not found");
    if (organization.plan === "disabled") {
      throw new Error("Bad Request: account je deaktiviran.");
    }
    if (input.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: input.brandId },
        select: { organizationId: true },
      });
      if (!brand || brand.organizationId !== input.organizationId) {
        throw new Error(
          "Forbidden: brand does not belong to this organization",
        );
      }
    }

    const metadata = {
      organizationId: input.organizationId,
      plan: checkoutPlan,
      intent: input.intent,
      ...(input.brandId ? { brandId: input.brandId } : {}),
    };
    const fallbackBrandPath =
      input.intent === "regular_scan"
        ? `/app/brands/${input.brandId}?billing=success&regularScan=1&session_id={CHECKOUT_SESSION_ID}`
        : `/app/brands/${input.brandId}?billing=success&session_id={CHECKOUT_SESSION_ID}`;
    const successPath = input.returnPath
      ? appendCheckoutSuccess(input.returnPath)
      : input.brandId
        ? fallbackBrandPath
        : "/app/settings?billing=success&session_id={CHECKOUT_SESSION_ID}";
    const cancelPath = input.returnPath
      ? appendCheckoutCanceled(input.returnPath)
      : input.brandId
        ? input.intent === "regular_scan"
          ? "/app/dashboard?billing=canceled&regularScan=1"
          : `/app/brands/${input.brandId}?billing=canceled`
        : "/pricing?billing=canceled";
    const stripe = new Stripe(config.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: organization.stripeCustomerId ?? undefined,
      customer_email: organization.stripeCustomerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.NEXT_PUBLIC_APP_URL}${successPath}`,
      cancel_url: `${config.NEXT_PUBLIC_APP_URL}${cancelPath}`,
      allow_promotion_codes: true,
      metadata,
      subscription_data: {
        metadata,
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: user.id,
        action: "billing_checkout_started",
      },
    });
    return ok({ url: session.url });
  });
}

function appendCheckoutSuccess(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}billing=success&session_id={CHECKOUT_SESSION_ID}`;
}

function appendCheckoutCanceled(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}billing=canceled`;
}
