import { notFound } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Activity } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { MetricCard } from "@/components/metric-card";
import {
  CompetitorMentionCount,
  ModelMentionBadges,
} from "@/components/model-mention-badges";
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
  const promptGroups = groupPromptRuns(scan.promptRuns);

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
        <MetricCard
          metric="visibility"
          value={scan.scoreSnapshot?.visibilityScore ?? 0}
        />
        <MetricCard
          metric="mentions"
          value={scan.scoreSnapshot?.mentionScore ?? 0}
        />
        <MetricCard
          metric="shareOfVoice"
          value={scan.scoreSnapshot?.shareOfVoiceScore ?? 0}
        />
        <MetricCard
          metric="accuracy"
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
                <TH>Modeli</TH>
                <TH>Konkurenti</TH>
                <TH>Najboljši rang</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {promptGroups.map((group) => (
                <TR key={group.promptId}>
                  <TD className="min-w-96">
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {group.promptText}
                      </summary>
                      <div className="mt-3 space-y-3 rounded-md border bg-secondary/30 p-3">
                        {group.runs.map((run) => (
                          <div
                            key={run.id}
                            className="rounded-md border bg-white p-3"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">
                                {run.engine.engineName}
                              </Badge>
                              <Badge variant={statusBadgeVariant(run.status)}>
                                {statusLabel(run.status)}
                              </Badge>
                            </div>
                            <div className="text-sm font-semibold">
                              Izvorni odgovor
                            </div>
                            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                              {run.aiResponse?.rawText ??
                                run.errorMessage ??
                                "Ni odgovora"}
                            </pre>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Citati:{" "}
                              {run.aiResponse?.citations
                                .map(
                                  (citation: { domain: string | null }) =>
                                    citation.domain,
                                )
                                .join(", ") || "-"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </TD>
                  <TD>
                    <ModelMentionBadges runs={modelSummaries(group.runs)} />
                  </TD>
                  <TD>
                    <CompetitorMentionCount
                      names={competitorNamesForRuns(group.runs)}
                    />
                  </TD>
                  <TD>{bestBrandRank(group.runs) ?? "-"}</TD>
                  <TD>
                    <Badge
                      variant={statusBadgeVariant(groupStatus(group.runs))}
                    >
                      {statusLabel(groupStatus(group.runs))}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

type BadgeVariant = "default" | "secondary" | "warning" | "danger" | "success";

function groupPromptRuns(promptRuns: Array<any>) {
  const groups = new Map<
    string,
    { promptId: string; promptText: string; runs: any[] }
  >();

  for (const run of promptRuns) {
    const promptId = run.prompt.id;
    const group =
      groups.get(promptId) ??
      ({
        promptId,
        promptText: run.prompt.text,
        runs: [],
      } as { promptId: string; promptText: string; runs: any[] });
    group.runs.push(run);
    groups.set(promptId, group);
  }

  return Array.from(groups.values());
}

function modelSummaries(runs: Array<any>) {
  return runs.map((run) => {
    const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
    return {
      id: run.id,
      engineName: run.engine.engineName,
      status: run.status,
      brandMentioned:
        typeof parsed?.brandMentioned === "boolean"
          ? parsed.brandMentioned
          : null,
      brandRank:
        typeof parsed?.brandRank === "number" ? parsed.brandRank : null,
    };
  });
}

function competitorNamesForRuns(runs: Array<any>) {
  return runs.flatMap((run) =>
    (run.aiResponse?.mentions ?? [])
      .filter((mention: any) => mention.entityType === "competitor")
      .map((mention: any) => mention.entityName),
  );
}

function bestBrandRank(runs: Array<any>) {
  const ranks = runs
    .map((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
      return typeof parsed?.brandRank === "number" ? parsed.brandRank : null;
    })
    .filter((rank): rank is number => typeof rank === "number");
  return ranks.length ? Math.min(...ranks) : null;
}

function groupStatus(runs: Array<any>) {
  if (runs.some((run) => run.status === "running" || run.status === "queued"))
    return "running";
  if (runs.every((run) => run.status === "failed")) return "failed";
  if (runs.some((run) => run.status === "completed")) return "completed";
  return runs[0]?.status ?? "queued";
}

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
