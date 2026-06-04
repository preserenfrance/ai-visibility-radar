import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const crawl = await prisma.crawlSnapshot.findFirst({
      where: { brandId: id },
      orderBy: { createdAt: "desc" },
      include: { pages: true }
    });
    return ok({ crawl });
  });
}
