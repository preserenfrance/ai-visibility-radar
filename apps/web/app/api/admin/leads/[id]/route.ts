import { requireAdminUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import { buildAdminLeadDetail } from "@/lib/services";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    await requireAdminUser();
    const { id } = await context.params;
    const detail = await buildAdminLeadDetail(id);
    return ok(detail);
  });
}
