import { runNextScanStep } from "@/lib/services";
import { requireScanAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export const maxDuration = 60;

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireScanAccess(id);
    const scan = await runNextScanStep(id);
    return ok({ scan });
  });
}
