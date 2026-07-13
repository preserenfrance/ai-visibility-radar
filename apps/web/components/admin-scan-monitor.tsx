"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type {
  AdminProviderSummary,
  AdminScanMonitorScan,
  AdminScanMonitorSnapshot,
} from "@/lib/admin-scan-monitor";

const REFRESH_INTERVAL_MS = 10_000;

type ScanMonitorAction = "cleanup-expired" | "settle-scan" | "cancel-scan";

type ScanMonitorActionResponse = {
  actionResult: unknown;
  snapshot: AdminScanMonitorSnapshot;
};

export function AdminScanMonitor({
  initialData,
}: {
  initialData: AdminScanMonitorSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutatingAction, setMutatingAction] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/scan-monitor", {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Refresh failed.");
      }
      setSnapshot((await response.json()) as AdminScanMonitorSnapshot);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Refresh failed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const runAction = useCallback(
    async (action: ScanMonitorAction, scanRunId?: string) => {
      const actionKey = scanRunId ? `${action}:${scanRunId}` : action;
      setMutatingAction(actionKey);
      setActionMessage(null);
      setActionError(null);

      try {
        const response = await fetch("/api/admin/scan-monitor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scanRunId ? { action, scanRunId } : { action }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error ?? "Action failed.");
        }

        const data = body as ScanMonitorActionResponse;
        setSnapshot(data.snapshot);
        setActionMessage(actionSuccessMessage(action, data.actionResult));
      } catch (actionFailure) {
        setActionError(
          actionFailure instanceof Error
            ? actionFailure.message
            : "Action failed.",
        );
      } finally {
        setMutatingAction(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoRefresh, refresh]);

  const hasHealthWarning =
    snapshot.health.failedScans24h > 0 ||
    snapshot.health.staleRunningPromptRuns > 0 ||
    snapshot.health.staleRunningScans > 0 ||
    snapshot.health.emailFailures24h > 0;
  const updatedAt = useMemo(
    () => formatDateTime(snapshot.generatedAt),
    [snapshot.generatedAt],
  );

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Activity className="h-5 w-5" />
            Admin monitor
          </div>
          <h1 className="text-3xl font-semibold">Live scan monitor</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Overview of the queue, prompt execution, providers, latest errors and
            completed results. Data refreshes without reloading the page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4"
            />
            Samodejno
          </label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {autoRefresh ? (
              <Wifi className="h-4 w-4 text-emerald-700" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {updatedAt}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => runAction("cleanup-expired")}
            disabled={Boolean(mutatingAction)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Settle stale
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={["h-4 w-4", isRefreshing ? "animate-spin" : ""]
                .filter(Boolean)
                .join(" ")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {hasHealthWarning && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">The monitor detected warnings.</div>
              <div className="mt-1">
                Errors or stale running records are shown below by scan and
                provider.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-md border bg-white px-4 py-3 text-sm text-muted-foreground">
        An active scan is automatically settled after{" "}
        <span className="font-medium text-foreground">
          {formatDuration(snapshot.queuePolicy.maxActiveMs)}
        </span>
        , if it is still queued or running by then.
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Queued"
          value={snapshot.health.queuedScans}
          hint={formatDuration(snapshot.health.oldestQueuedAgeMs)}
        />
        <MetricCard
          label="Running"
          value={snapshot.health.runningScans}
          hint={formatDuration(snapshot.health.oldestRunningAgeMs)}
        />
        <MetricCard
          label="Completed 24h"
          value={snapshot.health.completedScans24h}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Errors 24h"
          value={
            snapshot.health.failedScans24h + snapshot.health.emailFailures24h
          }
          tone={
            snapshot.health.failedScans24h + snapshot.health.emailFailures24h >
            0
              ? "danger"
              : "default"
          }
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Stale running scans"
          value={snapshot.health.staleRunningScans}
          tone={snapshot.health.staleRunningScans > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Stale running prompts"
          value={snapshot.health.staleRunningPromptRuns}
          tone={
            snapshot.health.staleRunningPromptRuns > 0 ? "warning" : "default"
          }
        />
        <MetricCard
          label="Canceled 24h"
          value={snapshot.health.canceledScans24h}
        />
        <MetricCard
          label="Avg. scan 24h"
          value={formatDuration(
            snapshot.health.averageCompletedScanDurationMs24h,
          )}
          icon={<Clock3 className="h-4 w-4" />}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <ProviderPanel providers={snapshot.providers} />
        <TriggerPanel snapshot={snapshot} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scans in progress</CardTitle>
          <CardDescription>
            All queued and running scans, with progress by prompt and latest
            activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScanTable
            scans={snapshot.activeScans}
            empty="There are no scans in progress right now."
            mutatingAction={mutatingAction}
            onCancel={(scanRunId) => runAction("cancel-scan", scanRunId)}
            onSettle={(scanRunId) => runAction("settle-scan", scanRunId)}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Latest results</CardTitle>
          <CardDescription>
            Completed, failed or canceled scans in the last 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScanTable
            scans={snapshot.recentScans}
            empty="No completed scans in the last 24 hours."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest prompt errors</CardTitle>
          <CardDescription>
            Useful for provider issues such as API funding, rate limits or
            timeouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Brand</TH>
                <TH>Provider</TH>
                <TH>Prompt</TH>
                <TH>Error</TH>
              </TR>
            </THead>
            <TBody>
              {snapshot.recentErrors.map((item) => (
                <TR key={item.id}>
                  <TD>{formatDateTime(item.finishedAt ?? item.startedAt)}</TD>
                  <TD>
                    <Link
                      className="font-medium text-primary"
                      href={`/app/brands/${item.brandId}/scans/${item.scanRunId}`}
                    >
                      {item.brandName}
                    </Link>
                  </TD>
                  <TD>
                    <div className="font-medium">
                      {providerLabel(item.provider)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.engineName}
                    </div>
                  </TD>
                  <TD>
                    <div className="max-w-sm truncate">{item.promptText}</div>
                  </TD>
                  <TD>
                    <div className="max-w-md truncate text-destructive">
                      {item.errorMessage ?? item.status}
                    </div>
                  </TD>
                </TR>
              ))}
              {snapshot.recentErrors.length === 0 && (
                <TR>
                  <TD colSpan={5} className="text-muted-foreground">
                    No prompt errors in the last 24 hours.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string | null;
  icon?: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card className={tone === "danger" ? "border-destructive/30" : undefined}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div
          className={[
            "text-2xl font-semibold",
            tone === "warning" ? "text-amber-800" : "",
            tone === "danger" ? "text-destructive" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-muted-foreground">
            oldest {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProviderPanel({ providers }: { providers: AdminProviderSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Providerji zadnjih 24h</CardTitle>
        <CardDescription>
          Prompt success rate and duration by LLM provider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Provider</TH>
              <TH>OK</TH>
              <TH>Errors</TH>
              <TH>Running</TH>
              <TH>Povp.</TH>
            </TR>
          </THead>
          <TBody>
            {providers.map((provider) => (
              <TR key={provider.provider}>
                <TD>
                  <div className="font-medium">
                    {providerLabel(provider.provider)}
                  </div>
                  {provider.latestError && (
                    <div className="max-w-xs truncate text-xs text-destructive">
                      {provider.latestError}
                    </div>
                  )}
                </TD>
                <TD>{provider.completed}</TD>
                <TD>
                  <span
                    className={
                      provider.failed > 0 || provider.skipped > 0
                        ? "text-destructive"
                        : undefined
                    }
                  >
                    {provider.failed + provider.skipped}
                  </span>
                </TD>
                <TD>{provider.running}</TD>
                <TD>{formatDuration(provider.averageDurationMs)}</TD>
              </TR>
            ))}
            {providers.length === 0 && (
              <TR>
                <TD colSpan={5} className="text-muted-foreground">
                  V zadnjih 24 urah ni prompt runov.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TriggerPanel({ snapshot }: { snapshot: AdminScanMonitorSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue by type</CardTitle>
        <CardDescription>
          Breakdown of manual, scheduled and free-audit scans that are currently
          queued or running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {snapshot.triggerTypes.map((item) => (
            <div key={item.triggerType} className="rounded-md border p-3">
              <div className="font-medium">
                {triggerLabel(item.triggerType)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Queued</div>
                  <div className="text-xl font-semibold">{item.queued}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Running</div>
                  <div className="text-xl font-semibold">{item.running}</div>
                </div>
              </div>
            </div>
          ))}
          {snapshot.triggerTypes.length === 0 && (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Queue je trenutno prazen.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScanTable({
  scans,
  empty,
  mutatingAction,
  onCancel,
  onSettle,
}: {
  scans: AdminScanMonitorScan[];
  empty: string;
  mutatingAction?: string | null;
  onCancel?: (scanRunId: string) => void;
  onSettle?: (scanRunId: string) => void;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Brand</TH>
          <TH>Status</TH>
          <TH>Napredek</TH>
          <TH>Providerji</TH>
          <TH>Rezultat</TH>
          <TH>Trajanje</TH>
          <TH>Zadnja aktivnost</TH>
          <TH>Error</TH>
          <TH>Action</TH>
        </TR>
      </THead>
      <TBody>
        {scans.map((scan) => (
          <TR key={scan.id}>
            <TD>
              <Link
                className="inline-flex items-center gap-1 font-medium text-primary"
                href={`/app/brands/${scan.brandId}/scans/${scan.id}`}
              >
                {scan.brandName}
                <ExternalLink className="h-3 w-3" />
              </Link>
              <div className="text-xs text-muted-foreground">
                {scan.brandDomain} · {scan.organizationName}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {triggerLabel(scan.triggerType)}
              </div>
            </TD>
            <TD>
              <StatusBadge status={scan.status} />
            </TD>
            <TD>
              <div className="min-w-36">
                <ProgressBar value={scan.progressPercent} />
                <div className="mt-1 text-xs text-muted-foreground">
                  {scan.promptCounts.completed} OK, {scan.promptCounts.failed}{" "}
                  failed, {scan.promptCounts.running} running,{" "}
                  {scan.promptCounts.queued} queued
                </div>
              </div>
            </TD>
            <TD>
              <div className="flex max-w-52 flex-wrap gap-1">
                {scan.providers.map((provider) => (
                  <Badge
                    key={provider.provider}
                    variant={
                      provider.failed > 0
                        ? "danger"
                        : provider.running > 0
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {providerLabel(provider.provider)} {provider.completed}/
                    {provider.total}
                  </Badge>
                ))}
              </div>
            </TD>
            <TD>
              {scan.score === null ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                <div className="font-medium">{scan.score}/100</div>
              )}
              <div className="text-xs text-muted-foreground">
                {scan.brandMentions} mentions
              </div>
            </TD>
            <TD>{formatDuration(scan.durationMs ?? scan.ageMs)}</TD>
            <TD>
              <div>
                {formatDateTime(scan.latestActivityAt ?? scan.updatedAt)}
              </div>
              {scan.oldestRunningPromptStartedAt && (
                <div className="text-xs text-amber-800">
                  running{" "}
                  {formatDurationSince(scan.oldestRunningPromptStartedAt)}
                </div>
              )}
            </TD>
            <TD>
              {scan.latestError ? (
                <div className="max-w-sm truncate text-destructive">
                  {scan.latestError}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TD>
            <TD>
              {(scan.status === "queued" || scan.status === "running") &&
              onSettle &&
              onCancel ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onSettle(scan.id)}
                    disabled={Boolean(mutatingAction)}
                  >
                    <CheckCircle2
                      className={[
                        "h-4 w-4",
                        mutatingAction === `settle-scan:${scan.id}`
                          ? "animate-spin"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    Settle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onCancel(scan.id)}
                    disabled={Boolean(mutatingAction)}
                  >
                    <XCircle
                      className={[
                        "h-4 w-4",
                        mutatingAction === `cancel-scan:${scan.id}`
                          ? "animate-spin"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    Cancel
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TD>
          </TR>
        ))}
        {scans.length === 0 && (
          <TR>
            <TD colSpan={9} className="text-muted-foreground">
              {empty}
            </TD>
          </TR>
        )}
      </TBody>
    </Table>
  );
}

function actionSuccessMessage(action: ScanMonitorAction, result: unknown) {
  if (action === "cleanup-expired") {
    const settled =
      typeof result === "object" && result !== null && "settled" in result
        ? Number((result as { settled?: unknown }).settled ?? 0)
        : 0;
    return `Settled stale scans: ${settled}.`;
  }

  if (action === "settle-scan") {
    return "The scan was settled and removed from the active queue.";
  }

  return "The scan was canceled and removed from the active queue.";
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "running") return <Badge variant="warning">in progress</Badge>;
  if (status === "queued") return <Badge variant="secondary">queued</Badge>;
  if (status === "completed") return <Badge variant="success">completed</Badge>;
  if (status === "failed") return <Badge variant="danger">error</Badge>;
  if (status === "canceled")
    return <Badge variant="secondary">canceled</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function providerLabel(provider: string) {
  if (provider === "openai") return "OpenAI";
  if (provider === "google") return "Gemini";
  if (provider === "anthropic") return "Claude";
  return provider;
}

function triggerLabel(triggerType: string) {
  if (triggerType === "manual") return "Manual scan";
  if (triggerType === "scheduled") return "Scheduled scan";
  if (triggerType === "free_audit") return "Free audit";
  return triggerType;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDurationSince(value: string) {
  return formatDuration(Date.now() - new Date(value).getTime());
}

function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
