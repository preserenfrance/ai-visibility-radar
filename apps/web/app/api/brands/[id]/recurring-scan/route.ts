import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import { activateRecurringScanForBrand, deactivateRecurringScanForBrand, type PaidPlan } from "@/lib/services";

const schema = z.object({
  action: z.enum(["activate", "deactivate"]).default("activate")
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const input = await parseBody(request, schema);

    if (input.action === "deactivate") {
      const brand = await deactivateRecurringScanForBrand(id);
      return ok({ brand });
    }

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        organization: {
          include: { billingSubscription: true }
        }
      }
    });
    if (!brand) throw new Error("Brand not found");

    const plan = brand.organization.plan;
    const billingStatus = brand.organization.billingSubscription?.status;
    if (plan === "free") throw new Error("Bad Request: Za reden scan najprej izberite plačljiv paket.");
    if (billingStatus !== "active" && billingStatus !== "trialing") {
      throw new Error("Bad Request: Naročnina še ni aktivna. Najprej zaključite plačilo.");
    }

    const updatedBrand = await activateRecurringScanForBrand(id, plan as PaidPlan);
    return ok({ brand: updatedBrand });
  });
}
