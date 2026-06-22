import { notFound } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Activity } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { ScanRunner } from "@/components/scan-runner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireScanAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ brandId: string; scanId: string }>;
}) {
  const { brandId, scanId } = await params;
  const access = await requireScanAccess(scanId);
  if (access.scan.brandId !== brandId) notFound();
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
              mentions: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!scan) return null;
  const scanPending = scan.status === "queued" || scan.status === "running";

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      {scanPending && <ScanRunner scanId={scan.id} />}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Izvedba scana</h1>
          <p className="text-muted-foreground">{scan.brand.name}</p>
        </div>
        <Badge variant={statusBadgeVariant(scan.status)}>
          {statusLabel(scan.status)}
        </Badge>
      </div>
      <BrandMenu brandId={brandId} />
      {scanPending && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 animate-pulse text-primary" />
              Scan se izvaja
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            AI modeli odgovarjajo na prompte in rezultat se bo prikazal takoj,
            ko bo obdelava končana. Stran se samodejno osvežuje.
          </CardContent>
        </Card>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric
          label="Vidnost"
          value={scan.scoreSnapshot?.visibilityScore ?? 0}
        />
        <Metric label="Omembe" value={scan.scoreSnapshot?.mentionScore ?? 0} />
        <Metric
          label="Delež glasu"
          value={scan.scoreSnapshot?.shareOfVoiceScore ?? 0}
        />
        <Metric
          label="Točnost"
          value={scan.scoreSnapshot?.accuracyScore ?? 0}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Izvedbe promptov</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Model</TH>
                <TH>Status</TH>
                <TH>Znamka</TH>
                <TH>Rang</TH>
                <TH>Sentiment</TH>
                <TH>Zaupanje</TH>
              </TR>
            </THead>
            <TBody>
              {scan.promptRuns.map((run) => {
                const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
                const resultReady = run.status === "completed" && parsed;
                return (
                  <TR key={run.id}>
                    <TD className="min-w-96">
                      <details>
                        <summary className="cursor-pointer font-medium">
                          {run.prompt.text}
                        </summary>
                        <div className="mt-3 space-y-3 rounded-md border bg-secondary/30 p-3">
                          <div className="text-sm font-semibold">
                            Izvorni odgovor
                          </div>
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                            {run.aiResponse?.rawText ??
                              run.errorMessage ??
                              "Ni odgovora"}
                          </pre>
                          <div className="text-sm font-semibold">
                            Razčlenjen rezultat
                          </div>
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs">
                            {JSON.stringify(parsed ?? {}, null, 2)}
                          </pre>
                          <div className="text-sm">
                            Citati:{" "}
                            {run.aiResponse?.citations
                              .map((citation) => citation.domain)
                              .join(", ") || "-"}
                          </div>
                          <div className="text-sm">
                            Konkurenti:{" "}
                            {run.aiResponse?.mentions
                              .filter(
                                (mention) =>
                                  mention.entityType === "competitor",
                              )
                              .map((mention) => mention.entityName)
                              .join(", ") || "-"}
                          </div>
                        </div>
                      </details>
                    </TD>
                    <TD>{run.engine.engineName}</TD>
                    <TD>
                      <Badge variant={statusBadgeVariant(run.status)}>
                        {statusLabel(run.status)}
                      </Badge>
                    </TD>
                    <TD>
                      {resultReady ? (
                        <Badge
                          variant={mentionBadgeVariant(parsed.brandMentioned)}
                        >
                          {parsed.brandMentioned ? "omenjena" : "ni omenjena"}
                        </Badge>
                      ) : null}
                    </TD>
                    <TD>{resultReady ? (parsed.brandRank ?? "-") : null}</TD>
                    <TD>{resultReady ? (parsed.sentiment ?? "-") : null}</TD>
                    <TD>{resultReady ? (parsed.confidence ?? "-") : null}</TD>
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

type BadgeVariant = "default" | "secondary" | "warning" | "danger" | "success";

function statusLabel(status: string) {
  switch (status) {
    case "queued":
    case "running":
      return "v delu";
    case "completed":
      return "končano";
    case "failed":
      return "napaka";
    case "canceled":
      return "preklicano";
    default:
      return status;
  }
}

function statusBadgeVariant(status: string): BadgeVariant {
  if (status === "queued" || status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "secondary";
}

function mentionBadgeVariant(brandMentioned: boolean): BadgeVariant {
  return brandMentioned ? "success" : "danger";
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
