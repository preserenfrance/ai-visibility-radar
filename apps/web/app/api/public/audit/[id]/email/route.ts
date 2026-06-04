import { sendLeadAuditEmail } from "@/lib/services";
import { ok, route } from "@/lib/http";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const email = await sendLeadAuditEmail(id);
    return ok({ email });
  });
}
