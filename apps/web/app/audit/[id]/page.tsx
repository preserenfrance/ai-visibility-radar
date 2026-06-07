import Link from "next/link";
import { prisma } from "@ai-radar/db";
import { Activity } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      auditScanRun: {
        include: {
          scoreSnapshot: true,
          recommendations: true,
          promptRuns: {
            include: { prompt: true, engine: true, aiResponse: { include: { parsedResult: true } } },
            take: 15
          }
        }
      }
    }
  });

  if (!lead) return <main className="p-8">Audit ni najden.</main>;
  const score = lead.auditScanRun?.scoreSnapshot;
  const reportPending =
    !score || lead.auditScanRun?.status === "queued" || lead.auditScanRun?.status === "running";

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      {reportPending && <AutoRefresh />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="secondary">Brezplačen audit</Badge>
          <h1 className="mt-3 text-3xl font-semibold">{lead.brandName}</h1>
          <p className="text-muted-foreground">{lead.domain}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/app/onboarding">Ustvari račun za celoten monitoring</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">Rezerviraj demo</Link>
          </Button>
        </div>
      </div>
      {reportPending && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 animate-pulse text-primary" />
              Pripravljamo prvi report
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Audit teče v ozadju: pripravljamo prompte, pošiljamo izbrane AI modele in računamo rezultat.
            Stran se bo samodejno osvežila.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="AI Visibility Score" value={score?.visibilityScore ?? 0} />
        <Metric label="Delež omemb" value={score?.mentionScore ?? 0} />
        <Metric label="Ocena citatov" value={score?.citationScore ?? 0} />
        <Metric label="Ocena točnosti" value={score?.accuracyScore ?? 0} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Primeri promptov</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Prompt</TH>
                  <TH>AI model</TH>
                  <TH>Omenjeno</TH>
                  <TH>Rang</TH>
                </TR>
              </THead>
              <TBody>
                {lead.auditScanRun?.promptRuns.slice(0, 3).map((run) => {
                  const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
                  return (
                    <TR key={run.id}>
                      <TD>{run.prompt.text}</TD>
                      <TD>{run.engine.engineName}</TD>
                      <TD>{parsed?.brandMentioned ? "Da" : "Ne"}</TD>
                      <TD>{parsed?.brandRank ?? "-"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Priporočene naloge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.auditScanRun?.recommendations.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="font-medium">{item.title}</div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}/100</div>
      </CardContent>
    </Card>
  );
}
