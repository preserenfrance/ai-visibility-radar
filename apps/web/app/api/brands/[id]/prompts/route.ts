import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const promptSet = await prisma.promptSet.findFirst({
      where: { brandId: id, status: "active" },
      orderBy: { createdAt: "desc" },
      include: { prompts: { orderBy: { priority: "asc" } } }
    });
    return ok({ promptSet });
  });
}
