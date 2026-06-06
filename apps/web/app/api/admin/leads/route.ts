import { prisma } from "@ai-radar/db";
import { requireAdminUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET() {
  return route(async () => {
    await requireAdminUser();
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        auditScanRun: {
          include: {
            scoreSnapshot: true,
            promptRuns: {
              include: { aiResponse: { include: { mentions: true } } }
            }
          }
        }
      }
    });
    return ok({ leads });
  });
}
