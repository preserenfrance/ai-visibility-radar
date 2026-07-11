import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { topCompetitorForScan } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/leads");
  if (!isAdminUser(user)) return <main className="p-8">You do not have access to the admin area.</main>;
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      auditScanRun: {
        include: {
          scoreSnapshot: true
        }
      }
    }
  });
  const topCompetitors = Object.fromEntries(
    await Promise.all(
      leads.map(async (lead) => [
        lead.id,
        lead.auditScanRunId ? await topCompetitorForScan(lead.auditScanRunId) : undefined
      ])
    )
  );

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Admin leads</h1>
        <p className="text-muted-foreground">Captured leads, audit result, top competitor and status.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lead table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Domain</TH>
                <TH>Brand</TH>
                <TH>AI Visibility Score</TH>
                <TH>Top competitor</TH>
                <TH>Lead score</TH>
                <TH>Created</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {leads.map((lead) => (
                <TR key={lead.id}>
                  <TD><Link className="text-primary" href={`/admin/leads/${lead.id}`}>{lead.email}</Link></TD>
                  <TD>{lead.domain}</TD>
                  <TD>{lead.brandName}</TD>
                  <TD>{lead.auditScanRun?.scoreSnapshot?.visibilityScore ?? "-"}</TD>
                  <TD>{topCompetitors[lead.id] ?? "-"}</TD>
                  <TD>{lead.leadScore}</TD>
                  <TD>{lead.createdAt.toLocaleString("en-US")}</TD>
                  <TD><Badge variant="secondary">{lead.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
