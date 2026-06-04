import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  status: z.enum(["open", "in_progress", "done", "dismissed"])
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const recommendation = await prisma.recommendation.findUnique({ where: { id } });
    if (!recommendation) throw new Error("Recommendation not found");
    await requireBrandAccess(recommendation.brandId);
    const input = await parseBody(request, schema);
    const updated = await prisma.recommendation.update({
      where: { id },
      data: { status: input.status }
    });
    return ok({ recommendation: updated });
  });
}
