import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { buildAdminLeadDetail } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/leads");
  if (!isAdminUser(user)) return <main className="p-8">You do not have access to the admin area.</main>;
  const { id } = await params;
  const { lead, salesBrief } = await buildAdminLeadDetail(id);
  if (!lead) return <main className="p-8">Lead not found.</main>;

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">{lead.brandName}</h1>
        <p className="text-muted-foreground">{lead.email} · {lead.domain}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Rezultat audita</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between"><span>Status</span><Badge variant="secondary">{lead.status}</Badge></div>
            <div className="flex justify-between"><span>Lead score</span><strong>{lead.leadScore}</strong></div>
            <div className="flex justify-between"><span>AI Visibility Score</span><strong>{lead.auditScanRun?.scoreSnapshot?.visibilityScore ?? "-"}</strong></div>
            <div className="flex justify-between"><span>Mention score</span><strong>{lead.auditScanRun?.scoreSnapshot?.mentionScore ?? "-"}</strong></div>
            <div className="flex justify-between"><span>Citation score</span><strong>{lead.auditScanRun?.scoreSnapshot?.citationScore ?? "-"}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Generiran prodajni povzetek</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-sm text-white">{salesBrief ?? "The report is not ready yet."}</pre>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Weakest prompts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Model</TH>
                <TH>Brand mentioned</TH>
                <TH>Rang</TH>
              </TR>
            </THead>
            <TBody>
              {lead.auditScanRun?.promptRuns.slice(0, 8).map((run) => {
                const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
                return (
                  <TR key={run.id}>
                    <TD>{run.prompt.text}</TD>
                    <TD>{run.engine.engineName}</TD>
                    <TD>{parsed?.brandMentioned ? "yes" : "no"}</TD>
                    <TD>{parsed?.brandRank ?? "-"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
