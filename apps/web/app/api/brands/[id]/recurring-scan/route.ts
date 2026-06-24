import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { canRunAutomaticScans } from "@/lib/billing";
import { ok, parseBody, route } from "@/lib/http";
import {
  activateRecurringScanForBrand,
  deactivateRecurringScanForBrand,
  type PaidPlan,
} from "@/lib/services";

const schema = z.object({
  action: z.enum(["activate", "deactivate"]).default("activate"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
          include: { billingSubscription: true },
        },
      },
    });
    if (!brand) throw new Error("Brand not found");
    if (!canRunAutomaticScans(brand.organization)) {
      throw new Error(
        "Bad Request: avtomatski scan je vključen v paket Growth.",
      );
    }

    const updatedBrand = await activateRecurringScanForBrand(
      id,
      brand.organization.plan as PaidPlan,
    );
    return ok({ brand: updatedBrand });
  });
}
