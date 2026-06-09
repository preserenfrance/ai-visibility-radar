import { prisma } from "@ai-radar/db";
import { ok, route } from "@/lib/http";
import { runNextScanStep } from "@/lib/services";

export const maxDuration = 60;

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { auditScanRunId: true }
    });

    if (!lead?.auditScanRunId) throw new Error("Bad Request: audit scan not found");
    if (process.env.REDIS_URL) {
      const scan = await prisma.scanRun.findUnique({
        where: { id: lead.auditScanRunId },
        include: { scoreSnapshot: true }
      });
      return ok({ scan });
    }

    const scan = await runNextScanStep(lead.auditScanRunId);
    return ok({ scan });
  });
}
