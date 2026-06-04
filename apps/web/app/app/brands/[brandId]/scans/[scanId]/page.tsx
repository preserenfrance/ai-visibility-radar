import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireScanAccess } from "@/lib/auth";

export default async function ScanPage({ params }: { params: Promise<{ brandId: string; scanId: string }> }) {
  const { scanId } = await params;
  await requireScanAccess(scanId);
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanId },
    include: {
      brand: true,
      scoreSnapshot: true,
      promptRuns: {
        include: {
          prompt: true,
          engine: true,
          aiResponse: {
            include: {
              parsedResult: true,
              citations: true,
              mentions: true
            }
          }
        },
        orderBy: [{ prompt: { priority: "asc" } }, { engine: { engineName: "asc" } }]
      }
    }
  });
  if (!scan) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Scan run</h1>
          <p className="text-muted-foreground">{scan.brand.name} · {scan.id}</p>
        </div>
        <Badge variant="secondary">{scan.status}</Badge>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric label="Visibility" value={scan.scoreSnapshot?.visibilityScore ?? 0} />
        <Metric label="Mention" value={scan.scoreSnapshot?.mentionScore ?? 0} />
        <Metric label="Share of voice" value={scan.scoreSnapshot?.shareOfVoiceScore ?? 0} />
        <Metric label="Accuracy" value={scan.scoreSnapshot?.accuracyScore ?? 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Prompt runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Engine</TH>
                <TH>Status</TH>
                <TH>Brand</TH>
                <TH>Rank</TH>
                <TH>Sentiment</TH>
                <TH>Confidence</TH>
              </TR>
            </THead>
            <TBody>
              {scan.promptRuns.map((run) => {
                const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
                return (
                  <TR key={run.id}>
                    <TD className="min-w-96">
                      <details>
                        <summary className="cursor-pointer font-medium">{run.prompt.text}</summary>
                        <div className="mt-3 space-y-3 rounded-md border bg-secondary/30 p-3">
                          <div className="text-sm font-semibold">Raw answer</div>
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                            {run.aiResponse?.rawText ?? run.errorMessage ?? "No response"}
                          </pre>
                          <div className="text-sm font-semibold">Parsed result</div>
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs">
                            {JSON.stringify(parsed ?? {}, null, 2)}
                          </pre>
                          <div className="text-sm">
                            Citations: {run.aiResponse?.citations.map((citation) => citation.domain).join(", ") || "-"}
                          </div>
                          <div className="text-sm">
                            Competitors: {run.aiResponse?.mentions
                              .filter((mention) => mention.entityType === "competitor")
                              .map((mention) => mention.entityName)
                              .join(", ") || "-"}
                          </div>
                        </div>
                      </details>
                    </TD>
                    <TD>{run.engine.engineName}</TD>
                    <TD><Badge variant={run.status === "failed" ? "danger" : "secondary"}>{run.status}</Badge></TD>
                    <TD>{parsed?.brandMentioned ? "mentioned" : "not mentioned"}</TD>
                    <TD>{parsed?.brandRank ?? "-"}</TD>
                    <TD>{parsed?.sentiment ?? "-"}</TD>
                    <TD>{parsed?.confidence ?? "-"}</TD>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">{value}/100</div>
      </CardContent>
    </Card>
  );
}
