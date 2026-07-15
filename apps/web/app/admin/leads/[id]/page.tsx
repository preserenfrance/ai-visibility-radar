import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageSquareText,
} from "lucide-react";
import type { ParsedAiResult } from "@ai-radar/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { buildAdminLeadDetail } from "@/lib/services";

export const dynamic = "force-dynamic";

type AdminLeadDetail = Awaited<ReturnType<typeof buildAdminLeadDetail>>;
type LeadDetail = NonNullable<AdminLeadDetail["lead"]>;
type PromptRun = NonNullable<LeadDetail["auditScanRun"]>["promptRuns"][number];

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/leads");
  if (!isAdminUser(user)) {
    return (
      <main className="p-8">You do not have access to the admin area.</main>
    );
  }

  const { id } = await params;
  const { lead, salesBrief } = await buildAdminLeadDetail(id);
  if (!lead) return <main className="p-8">Lead not found.</main>;

  const promptRuns = lead.auditScanRun?.promptRuns ?? [];
  const completedRuns = promptRuns.filter(
    (run) => run.status === "completed",
  ).length;
  const failedRuns = promptRuns.filter((run) => run.status === "failed").length;

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{lead.brandName}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{lead.email}</span>
          <span>&middot;</span>
          <span>{lead.domain}</span>
          <span>&middot;</span>
          <span>{lead.createdAt.toLocaleString("sl-SI")}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Rezultat audita</CardTitle>
            <CardDescription>
              Lead, score in stanje izvedbe audita.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <MetricRow
              label="Status"
              value={<Badge variant="secondary">{lead.status}</Badge>}
            />
            <MetricRow label="Lead score" value={lead.leadScore} />
            <MetricRow
              label="AI Visibility Score"
              value={lead.auditScanRun?.scoreSnapshot?.visibilityScore ?? "-"}
            />
            <MetricRow
              label="Mention score"
              value={lead.auditScanRun?.scoreSnapshot?.mentionScore ?? "-"}
            />
            <MetricRow
              label="Citation score"
              value={lead.auditScanRun?.scoreSnapshot?.citationScore ?? "-"}
            />
            <MetricRow
              label="Prompt runs"
              value={`${completedRuns}/${promptRuns.length} completed`}
            />
            {failedRuns > 0 && (
              <MetricRow
                label="Failed runs"
                value={<Badge variant="danger">{failedRuns}</Badge>}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generiran prodajni povzetek</CardTitle>
            <CardDescription>Interni povzetek za follow-up.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-sm leading-6 text-white">
              {salesBrief ?? "The report is not ready yet."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Prompti in AI odgovori</h2>
            <p className="text-sm text-muted-foreground">
              Vsi prompti, modeli, parsed rezultat, citati in raw odgovor za ta
              lead.
            </p>
          </div>
          <Badge variant="secondary">{promptRuns.length} runs</Badge>
        </div>

        {promptRuns.length > 0 ? (
          <div className="grid gap-4">
            {promptRuns.map((run, index) => (
              <PromptRunCard
                key={run.id}
                run={run}
                index={index}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Za ta lead ni shranjenih prompt runov.
            </CardContent>
          </Card>
        )}
      </section>
    </section>
  );
}

function PromptRunCard({
  run,
  index,
  defaultOpen,
}: {
  run: PromptRun;
  index: number;
  defaultOpen: boolean;
}) {
  const parsed = parsedResult(run);
  const citations = run.aiResponse?.citations ?? [];
  const rawAnswer = run.aiResponse?.rawText;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">#{index + 1}</Badge>
              <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
              <Badge variant="secondary">{run.engine.engineName}</Badge>
              {run.engine.searchEnabled && (
                <Badge variant="default">search enabled</Badge>
              )}
            </div>
            <CardTitle className="leading-6">{run.prompt.text}</CardTitle>
            <CardDescription className="mt-2">
              {run.prompt.category} / {run.prompt.intent} /{" "}
              {run.prompt.funnelStage}
            </CardDescription>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-right text-xs text-muted-foreground md:min-w-56">
            <span>Created</span>
            <strong className="font-medium text-foreground">
              {run.createdAt.toLocaleString("sl-SI")}
            </strong>
            {run.finishedAt && (
              <>
                <span>Finished</span>
                <strong className="font-medium text-foreground">
                  {run.finishedAt.toLocaleString("sl-SI")}
                </strong>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-md border bg-secondary/30 p-3 text-sm md:grid-cols-5">
          <ResultMetric
            label="Brand mentioned"
            value={parsed?.brandMentioned ? "yes" : parsed ? "no" : "-"}
            positive={parsed?.brandMentioned}
          />
          <ResultMetric label="Brand rank" value={parsed?.brandRank ?? "-"} />
          <ResultMetric label="Mentions" value={parsed?.mentionCount ?? "-"} />
          <ResultMetric label="Sentiment" value={parsed?.sentiment ?? "-"} />
          <ResultMetric label="Accuracy" value={parsed?.accuracyScore ?? "-"} />
        </div>

        {run.errorMessage && (
          <div className="flex gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{run.errorMessage}</span>
          </div>
        )}

        <details
          open={defaultOpen}
          className="group rounded-md border bg-white"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary" />
              AI odgovor
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              Odpri
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              Zapri
            </span>
          </summary>
          <div className="border-t p-4">
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-sm leading-6 text-white">
              {rawAnswer ?? "Odgovor se ni shranjen."}
            </pre>
          </div>
        </details>

        {citations.length > 0 && (
          <div className="rounded-md border bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              Citati
            </div>
            <div className="grid gap-2">
              {citations.map((citation) => (
                <a
                  key={citation.id}
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-start justify-between gap-3 rounded-sm bg-secondary px-3 py-2 text-sm hover:bg-secondary/75"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {citation.title ?? citation.domain}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {citation.url}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-semibold">{value}</strong>
    </div>
  );
}

function ResultMetric({
  label,
  value,
  positive,
}: {
  label: string;
  value: ReactNode;
  positive?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={[
          "mt-1 font-semibold",
          positive === true && "text-emerald-700",
          positive === false && "text-destructive",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function parsedResult(run: PromptRun) {
  return run.aiResponse?.parsedResult?.parsedJson as
    | ParsedAiResult
    | null
    | undefined;
}

function statusVariant(
  status: PromptRun["status"],
): "secondary" | "warning" | "danger" | "success" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
      return "warning";
    default:
      return "secondary";
  }
}
