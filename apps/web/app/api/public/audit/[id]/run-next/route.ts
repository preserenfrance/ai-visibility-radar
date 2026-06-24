import { prisma } from "@ai-radar/db";
import { ok, route } from "@/lib/http";

export const maxDuration = 10;

export async function POST(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(async () => {
    const { id } = await context.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { auditScanRunId: true },
    });

    if (!lead?.auditScanRunId)
      throw new Error("Bad Request: audit scan not found");
    const scan = await prisma.scanRun.findUnique({
      where: { id: lead.auditScanRunId },
      include: { scoreSnapshot: true },
    });
    return ok({ scan });
  });
}
