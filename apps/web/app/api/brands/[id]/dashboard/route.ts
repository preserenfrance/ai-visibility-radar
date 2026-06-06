import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        competitors: true,
        scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 12 },
        scanRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            scoreSnapshot: true,
            recommendations: true,
            promptRuns: {
              include: {
                prompt: true,
                engine: true,
                aiResponse: { include: { parsedResult: true, citations: true, mentions: true } }
              }
            }
          }
        }
      }
    });
    if (!brand) throw new Error("Brand not found");

    const latestScan = brand.scanRuns[0];
    const engineBreakdown =
      latestScan?.promptRuns.reduce<Record<string, { total: number; mentioned: number; rankSum: number; ranked: number }>>(
        (acc, run) => {
          const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
          const engine = run.engine.engineName;
          const bucket = (acc[engine] ??= { total: 0, mentioned: 0, rankSum: 0, ranked: 0 });
          bucket.total += 1;
          if (parsed?.brandMentioned) bucket.mentioned += 1;
          if (typeof parsed?.brandRank === "number") {
            bucket.rankSum += parsed.brandRank;
            bucket.ranked += 1;
          }
          return acc;
        },
        {}
      ) ?? {};

    const competitorMentions = await prisma.mention.groupBy({
      by: ["entityName"],
      where: {
        entityType: "competitor",
        aiResponse: { promptRun: { scanRun: { brandId: id } } }
      },
      _count: { entityName: true },
      _avg: { rankPosition: true },
      orderBy: { _count: { entityName: "desc" } },
      take: 10
    });

    const topCitations = await prisma.citation.groupBy({
      by: ["domain"],
      where: {
        aiResponse: { promptRun: { scanRun: { brandId: id } } }
      },
      _count: { domain: true },
      orderBy: { _count: { domain: "desc" } },
      take: 10
    });

    return ok({
      brand,
      latestScan,
      score: latestScan?.scoreSnapshot ?? null,
      trend: brand.scoreSnapshots,
      engineBreakdown,
      topCompetitors: competitorMentions,
      topCitations
    });
  });
}
