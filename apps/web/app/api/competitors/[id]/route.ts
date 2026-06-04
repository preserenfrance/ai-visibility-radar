import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const competitor = await prisma.competitor.findUnique({ where: { id } });
    if (!competitor) throw new Error("Competitor not found");
    await requireBrandAccess(competitor.brandId);
    await prisma.competitor.delete({ where: { id } });
    return ok({ ok: true });
  });
}
