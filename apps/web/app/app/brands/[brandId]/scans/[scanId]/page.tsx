import { Fragment } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Activity, X } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { MetricCard } from "@/components/metric-card";
import {
  CompetitorMentionCount,
  EngineIcon,
  MentionIndicator,
  type ModelMentionColumn,
  type ModelMentionSummary,
  modelMentionColumnForRun,
  modelMentionColumns,
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
  const modelColumns = modelMentionColumns(modelSummaries(scan.promptRuns));

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
                <TH className="min-w-[22rem]">Prompt</TH>
                {modelColumns.map((column) => (
                  <TH
                    key={column.key}
                    className="w-14 px-2 text-center normal-case"
                    title={column.label}
                    aria-label={column.label}
                  >
                    <span className="flex justify-center">
                      <EngineIcon column={column} />
                    </span>
                  </TH>
                ))}
                <TH className="whitespace-nowrap">Konkurenti</TH>
                <TH className="whitespace-nowrap">Najboljši rang</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {promptGroups.map((group) => {
                const status = groupStatus(group.runs);
                const summaries = modelSummaries(group.runs);

                return (
                  <Fragment key={group.promptId}>
                    <TR>
                      <TD className="max-w-xl font-medium">
                        {group.promptText}
                      </TD>
                      {modelColumns.map((column) => (
                        <TD key={column.key} className="w-14 px-2 text-center">
                          <MentionIndicator
                            runs={runsForModelColumn(summaries, column)}
                          />
                        </TD>
                      ))}
                      <TD>
                        <CompetitorMentionCount
                          names={competitorNamesForRuns(group.runs)}
                        />
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatRank(bestBrandRank(group.runs))}
                      </TD>
                      <TD>
                        <Badge variant={statusBadgeVariant(status)}>
                          {statusLabel(status)}
                        </Badge>
                      </TD>
                    </TR>
                    <TR className="hover:bg-transparent">
                      <TD
                        colSpan={modelColumns.length + 4}
                        className="border-t-0 p-0"
                      >
                        <details className="bg-secondary/10">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-primary">
                            Odgovori modelov in citati
                          </summary>
                          <div className="space-y-3 border-t bg-secondary/20 p-3">
                            {group.runs.map((run) => (
                              <div
                                key={run.id}
                                className="rounded-md border bg-background p-3"
                              >
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">
                                    {run.engine.engineName}
                                  </Badge>
                                  <Badge
                                    variant={statusBadgeVariant(run.status)}
                                  >
                                    {statusLabel(run.status)}
                                  </Badge>
                                </div>
                                <div className="text-sm font-semibold">
                                  Izvorni odgovor
                                </div>
                                <pre className="mt-1 max-h-72 w-full overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
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
                    </TR>
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <LegendDot
              className="border-emerald-700 bg-emerald-500"
              label="znamka omenjena"
            />
            <LegendDot
              className="border-rose-700 bg-rose-500"
              label="znamka ni omenjena"
            />
            <LegendError label="napaka pri izvedbi" />
            <LegendDot
              className="border-amber-700 bg-amber-400"
              label="čaka na rezultat"
            />
          </div>
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

function modelSummaries(runs: Array<any>): ModelMentionSummary[] {
  return runs.map((run) => {
    const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
    return {
      id: run.id,
      engineName: run.engine.engineName,
      provider: run.engine.provider,
      searchEnabled: run.engine.searchEnabled,
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

function runsForModelColumn(
  runs: ModelMentionSummary[],
  column: ModelMentionColumn,
) {
  return runs.filter((run) => modelMentionColumnForRun(run).key === column.key);
}

function formatRank(rank: number | null) {
  return rank ? `#${rank}` : "-";
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-3.5 w-3.5 rounded-full border shadow-sm ${className}`}
      />
      {label}
    </span>
  );
}

function LegendError({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-rose-800 bg-rose-600 text-white shadow-sm">
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      {label}
    </span>
  );
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
