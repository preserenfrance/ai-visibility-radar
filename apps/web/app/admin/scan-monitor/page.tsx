import { redirect } from "next/navigation";
import { AdminScanMonitor } from "@/components/admin-scan-monitor";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { buildAdminScanMonitorSnapshot } from "@/lib/admin-scan-monitor";

export const dynamic = "force-dynamic";

export default async function AdminScanMonitorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/scan-monitor");
  if (!isAdminUser(user))
    return <main className="p-8">Nimate dostopa do admin strani.</main>;

  const snapshot = await buildAdminScanMonitorSnapshot();
  return <AdminScanMonitor initialData={snapshot} />;
}
