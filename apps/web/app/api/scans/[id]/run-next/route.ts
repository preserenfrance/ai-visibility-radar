import { prisma } from "@ai-radar/db";
import { requireScanAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export const maxDuration = 10;

export async function POST(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(async () => {
    const { id } = await context.params;
    await requireScanAccess(id);
    const scan = await prisma.scanRun.findUnique({
      where: { id },
      include: { scoreSnapshot: true },
    });
    return ok({ scan });
  });
}
