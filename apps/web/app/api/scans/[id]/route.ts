import { prisma } from "@ai-radar/db";
import { requireScanAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireScanAccess(id);
    const scan = await prisma.scanRun.findUnique({
      where: { id },
      include: {
        brand: true,
        scoreSnapshot: true,
        recommendations: true,
        promptRuns: {
          include: { prompt: true, engine: true, aiResponse: { include: { parsedResult: true, citations: true, mentions: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    return ok({ scan });
  });
}
