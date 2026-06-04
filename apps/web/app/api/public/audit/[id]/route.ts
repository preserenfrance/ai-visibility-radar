import { prisma } from "@ai-radar/db";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const lead = await prisma.lead.update({
      where: { id },
      data: { status: "opened" },
      include: {
        auditScanRun: {
          include: {
            scoreSnapshot: true,
            recommendations: true,
            promptRuns: {
              include: { prompt: true, engine: true, aiResponse: { include: { parsedResult: true, citations: true } } },
              take: 15
            }
          }
        }
      }
    });
    await prisma.auditLog.create({
      data: {
        organizationId: lead.organizationId,
        action: "report_viewed",
        entityType: "Lead",
        entityId: lead.id
      }
    });
    return ok({ lead });
  });
}
