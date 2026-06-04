import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const recommendations = await prisma.recommendation.findMany({
      where: { brandId: id },
      orderBy: [{ status: "asc" }, { impactScore: "desc" }, { createdAt: "desc" }]
    });
    return ok({ recommendations });
  });
}
