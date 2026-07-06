import { requireAdminUser } from "@/lib/auth";
import { buildAdminScanMonitorSnapshot } from "@/lib/admin-scan-monitor";
import {
  cancelActiveScanRun,
  settleExpiredActiveScans,
  settleScanRun,
} from "@/lib/scan-queue";
import { ok, parseBody, route } from "@/lib/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cleanup-expired") }),
  z.object({
    action: z.literal("settle-scan"),
    scanRunId: z.string().min(1),
  }),
  z.object({
    action: z.literal("cancel-scan"),
    scanRunId: z.string().min(1),
  }),
]);

export async function GET() {
  return route(async () => {
    await requireAdminUser();
    return ok(await buildAdminScanMonitorSnapshot());
  });
}

export async function POST(request: Request) {
  return route(async () => {
    await requireAdminUser();
    const body = await parseBody(request, actionSchema);
    const actionResult = await runAction(body);
    return ok({
      actionResult,
      snapshot: await buildAdminScanMonitorSnapshot(),
    });
  });
}

async function runAction(body: z.output<typeof actionSchema>) {
  if (body.action === "cleanup-expired") {
    return settleExpiredActiveScans();
  }

  if (body.action === "settle-scan") {
    return settleScanRun(
      body.scanRunId,
      "Scan je bil zakljucen rocno v admin monitorju.",
    );
  }

  return cancelActiveScanRun(
    body.scanRunId,
    "Scan je bil preklican v admin monitorju.",
  );
}
