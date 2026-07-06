import { requireAdminUser } from "@/lib/auth";
import { buildAdminScanMonitorSnapshot } from "@/lib/admin-scan-monitor";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return route(async () => {
    await requireAdminUser();
    return ok(await buildAdminScanMonitorSnapshot());
  });
}
