import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import { Activity, CalendarClock, Clock3, Mail, RefreshCw } from "lucide-react";
import { type EmailEventType, type ScanRunStatus, prisma } from "@ai-radar/db";
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
import { getCurrentUser, isAdminUser, requireAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CRON_SCHEDULE = "*/5 * * * *";
const CRON_LABEL = "vsakih 5 minut";

type RecurringBrand = {
  id: string;
  name: string;
  domain: string;
  recurringScanCadence: "weekly" | "daily" | null;
  recurringScanNextRunAt: Date | null;
  organization: {
    name: string;
    plan: string;
  };
};

async function cancelScanRun(formData: FormData) {
  "use server";
  await requireAdminUser();

  const scanRunId = String(formData.get("scanRunId") ?? "");
  if (!scanRunId) throw new Error("Bad Request: manjka scanRunId");

  await prisma.$transaction([
    prisma.scanRun.updateMany({
      where: {
        id: scanRunId,
        status: { in: ["queued", "running"] },
      },
      data: {
        status: "canceled",
        finishedAt: new Date(),
      },
    }),
    prisma.promptRun.updateMany({
      where: {
        scanRunId,
        status: { in: ["queued", "running"] },
      },
      data: {
        status: "skipped",
        finishedAt: new Date(),
        errorMessage: "Preklicano v adminu.",
      },
    }),
  ]);

  redirect("/admin/operations?updated=scan-canceled");
}

async function stopRecurringScan(formData: FormData) {
  "use server";
  await requireAdminUser();

  const brandId = String(formData.get("brandId") ?? "");
  if (!brandId) throw new Error("Bad Request: manjka brandId");

  await prisma.brand.update({
    where: { id: brandId },
    data: {
      recurringScanActive: false,
      recurringScanNextRunAt: null,
    },
  });

  redirect("/admin/operations?updated=recurring-stopped");
}

export default async function AdminOperationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/operations");
  if (!isAdminUser(user))
    return <main className="p-8">Nimate dostopa do admin strani.</main>;

  const now = new Date();
  const lastHour = addHours(now, -1);
  const lastDay = addDays(now, -1);
  const lastWeek = addDays(now, -7);
  const nextDay = addDays(now, 1);
  const nextWeek = addDays(now, 7);
  const nextMonth = addDays(now, 30);

  const [
    recurringBrands,
    pendingScans,
    currentQueuedScans,
    currentRunningScans,
    scheduledScanStatusGroups,
    emailStatusAll,
    emailStatusLastDay,
    emailStatusLastWeek,
    recentEmailEvents,
  ] = await Promise.all([
    prisma.brand.findMany({
      where: {
        recurringScanActive: true,
        recurringScanNextRunAt: { not: null },
      },
      orderBy: { recurringScanNextRunAt: "asc" },
      select: {
        id: true,
        name: true,
        domain: true,
        recurringScanCadence: true,
        recurringScanNextRunAt: true,
        organization: {
          select: {
            name: true,
            plan: true,
          },
        },
      },
    }),
    prisma.scanRun.findMany({
      where: {
        triggerType: { in: ["manual", "scheduled"] },
        status: { in: ["queued", "running"] },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            domain: true,
            organization: {
              select: {
                name: true,
                plan: true,
              },
            },
          },
        },
      },
    }),
    prisma.scanRun.count({
      where: {
        triggerType: { in: ["manual", "scheduled"] },
        status: "queued",
      },
    }),
    prisma.scanRun.count({
      where: {
        triggerType: { in: ["manual", "scheduled"] },
        status: "running",
      },
    }),
    prisma.scanRun.groupBy({
      by: ["status"],
      where: {
        triggerType: "scheduled",
        createdAt: { gte: lastWeek },
      },
      _count: { _all: true },
    }),
    prisma.emailEvent.groupBy({
      by: ["type"],
      _count: { _all: true },
    }),
    prisma.emailEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: lastDay } },
      _count: { _all: true },
    }),
    prisma.emailEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: lastWeek } },
      _count: { _all: true },
    }),
    prisma.emailEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        lead: {
          select: {
            email: true,
            domain: true,
          },
        },
      },
    }),
  ]);

  const activeRecurringCount = recurringBrands.length;
  const dueRecurringCount = recurringBrands.filter(
    (brand) => brand.recurringScanNextRunAt! <= now,
  ).length;
  const nextDayRecurringCount = recurringBrands.filter(
    (brand) => brand.recurringScanNextRunAt! <= nextDay,
  ).length;
  const nextWeekRecurringCount = recurringBrands.filter(
    (brand) => brand.recurringScanNextRunAt! <= nextWeek,
  ).length;
  const nextMonthRecurringCount = recurringBrands.filter(
    (brand) => brand.recurringScanNextRunAt! <= nextMonth,
  ).length;
  const estimatedNextWeekRuns = estimateRecurringRuns(
    recurringBrands,
    now,
    nextWeek,
  );
  const estimatedNextMonthRuns = estimateRecurringRuns(
    recurringBrands,
    now,
    nextMonth,
  );

  const completedScheduledScans = scheduledStatusCount(
    scheduledScanStatusGroups,
    "completed",
  );
  const failedScheduledScans = scheduledStatusCount(
    scheduledScanStatusGroups,
    "failed",
  );

  const emailsSentLastDay = emailStatusCount(emailStatusLastDay, "sent");
  const emailsQueuedAll = emailStatusCount(emailStatusAll, "queued");
  const emailsFailedLastDay = emailStatusCount(emailStatusLastDay, "failed");
  const emailsLastWeek = emailStatusLastWeek.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );
  const emailsLastHour = await prisma.emailEvent.count({
    where: { createdAt: { gte: lastHour } },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Activity className="h-5 w-5" />
            Admin operacije
          </div>
          <h1 className="text-3xl font-semibold">Scheduled scani in e-maili</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Operativni pregled recurring scanov, queue stanja in zabeleženih
            e-mail dogodkov.
          </p>
        </div>
        <div className="rounded-lg border bg-white px-5 py-4 text-right">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Vercel cron
          </div>
          <div className="mt-1 text-2xl font-semibold">{CRON_LABEL}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {CRON_SCHEDULE}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={<RefreshCw className="h-5 w-5" />}
          label="Aktivni recurring scani"
          value={activeRecurringCount}
        />
        <MetricCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Zapadli zdaj"
          value={dueRecurringCount}
          tone={dueRecurringCount > 0 ? "warning" : "default"}
        />
        <MetricCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Naslednjih 7 dni"
          value={estimatedNextWeekRuns}
        />
        <MetricCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Naslednjih 30 dni"
          value={estimatedNextMonthRuns}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Queued operacije" value={currentQueuedScans} />
        <MetricCard label="Running operacije" value={currentRunningScans} />
        <MetricCard label="Zaključeni 7 dni" value={completedScheduledScans} />
        <MetricCard
          label="Napake 7 dni"
          value={failedScheduledScans}
          tone={failedScheduledScans > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={<Mail className="h-5 w-5" />}
          label="E-maili 1h"
          value={emailsLastHour}
        />
        <MetricCard label="Poslani 24h" value={emailsSentLastDay} />
        <MetricCard label="V čakanju skupaj" value={emailsQueuedAll} />
        <MetricCard
          label="Napake 24h"
          value={emailsFailedLastDay}
          tone={emailsFailedLastDay > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Prihodnji scheduled pregledi</CardTitle>
            <CardDescription>
              Naslednji zapisani termini po znamkah. Ocenjeni ponavljajoči
              pregledi vključujejo tudi tedenske oziroma dnevne ponovitve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <InlineMetric
                label="Naslednjih 24h"
                value={nextDayRecurringCount}
              />
              <InlineMetric
                label="Naslednjih 7 dni"
                value={nextWeekRecurringCount}
              />
              <InlineMetric
                label="Naslednjih 30 dni"
                value={nextMonthRecurringCount}
              />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Znamka</TH>
                  <TH>Organizacija</TH>
                  <TH>Kadenca</TH>
                  <TH>Naslednji termin</TH>
                  <TH>Akcija</TH>
                </TR>
              </THead>
              <TBody>
                {recurringBrands.slice(0, 20).map((brand) => (
                  <TR key={brand.id}>
                    <TD>
                      <Link
                        className="font-medium text-primary"
                        href={`/app/brands/${brand.id}`}
                      >
                        {brand.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {brand.domain}
                      </div>
                    </TD>
                    <TD>
                      <div>{brand.organization.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {brand.organization.plan}
                      </div>
                    </TD>
                    <TD>{cadenceLabel(brand.recurringScanCadence)}</TD>
                    <TD>
                      {brand.recurringScanNextRunAt?.toLocaleString("sl-SI")}
                    </TD>
                    <TD>
                      <form action={stopRecurringScan}>
                        <input type="hidden" name="brandId" value={brand.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Ustavi urnik
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
                {recurringBrands.length === 0 && (
                  <TR>
                    <TD colSpan={5} className="text-muted-foreground">
                      Ni aktivnih scheduled pregledov.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queued / running scani</CardTitle>
            <CardDescription>
              Trenutni ročni in scheduled scan runi, ki čakajo ali se izvajajo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Znamka</TH>
                  <TH>Tip</TH>
                  <TH>Status</TH>
                  <TH>Ustvarjeno</TH>
                  <TH>Akcija</TH>
                </TR>
              </THead>
              <TBody>
                {pendingScans.map((scan) => (
                  <TR key={scan.id}>
                    <TD>
                      <Link
                        className="font-medium text-primary"
                        href={`/app/brands/${scan.brandId}/scans/${scan.id}`}
                      >
                        {scan.brand.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {scan.brand.organization.name}
                      </div>
                    </TD>
                    <TD>{scan.triggerType}</TD>
                    <TD>
                      <ScanStatusBadge status={scan.status} />
                    </TD>
                    <TD>{scan.createdAt.toLocaleString("sl-SI")}</TD>
                    <TD>
                      <form action={cancelScanRun}>
                        <input type="hidden" name="scanRunId" value={scan.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Prekini
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
                {pendingScans.length === 0 && (
                  <TR>
                    <TD colSpan={5} className="text-muted-foreground">
                      Ni ročnih ali scheduled scanov v queueju.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>E-mail statusi</CardTitle>
            <CardDescription>
              Zabeleženi e-mail dogodki. Skupaj zadnjih 7 dni: {emailsLastWeek}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Status</TH>
                  <TH>Skupaj</TH>
                  <TH>24h</TH>
                  <TH>7 dni</TH>
                </TR>
              </THead>
              <TBody>
                {EMAIL_TYPES.map((type) => (
                  <TR key={type}>
                    <TD>
                      <EmailStatusBadge type={type} />
                    </TD>
                    <TD>{emailStatusCount(emailStatusAll, type)}</TD>
                    <TD>{emailStatusCount(emailStatusLastDay, type)}</TD>
                    <TD>{emailStatusCount(emailStatusLastWeek, type)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zadnji e-mail dogodki</CardTitle>
            <CardDescription>
              Zadnji zapisi iz e-mail event loga, vključno z napakami.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Čas</TH>
                  <TH>Status</TH>
                  <TH>Zadeva</TH>
                  <TH>Lead</TH>
                </TR>
              </THead>
              <TBody>
                {recentEmailEvents.map((event) => (
                  <TR key={event.id}>
                    <TD>{event.createdAt.toLocaleString("sl-SI")}</TD>
                    <TD>
                      <EmailStatusBadge type={event.type} />
                    </TD>
                    <TD>
                      <div className="max-w-md truncate">
                        {event.subject ?? "-"}
                      </div>
                      {event.errorMessage && (
                        <div className="max-w-md truncate text-xs text-destructive">
                          {event.errorMessage}
                        </div>
                      )}
                    </TD>
                    <TD>
                      {event.lead ? (
                        <div>
                          <div>{event.lead.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {event.lead.domain}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TD>
                  </TR>
                ))}
                {recentEmailEvents.length === 0 && (
                  <TR>
                    <TD colSpan={4} className="text-muted-foreground">
                      Ni zabeleženih e-mail dogodkov.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

const EMAIL_TYPES: EmailEventType[] = [
  "queued",
  "sent",
  "failed",
  "opened",
  "clicked",
];

function MetricCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
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
          {value.toLocaleString("sl-SI")}
        </div>
      </CardContent>
    </Card>
  );
}

function InlineMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-secondary/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">
        {value.toLocaleString("sl-SI")}
      </div>
    </div>
  );
}

function scheduledStatusCount(
  groups: Array<{ status: ScanRunStatus; _count: { _all: number } }>,
  status: ScanRunStatus,
) {
  return groups.find((item) => item.status === status)?._count._all ?? 0;
}

function emailStatusCount(
  groups: Array<{ type: EmailEventType; _count: { _all: number } }>,
  type: EmailEventType,
) {
  return groups.find((item) => item.type === type)?._count._all ?? 0;
}

function estimateRecurringRuns(
  brands: RecurringBrand[],
  from: Date,
  until: Date,
) {
  return brands.reduce(
    (sum, brand) => sum + countBrandOccurrences(brand, from, until),
    0,
  );
}

function countBrandOccurrences(brand: RecurringBrand, from: Date, until: Date) {
  if (!brand.recurringScanNextRunAt) return 0;
  let count = 0;
  let nextRunAt = new Date(brand.recurringScanNextRunAt);
  let guard = 0;

  while (nextRunAt <= until && guard < 40) {
    if (nextRunAt >= from) count += 1;
    nextRunAt = advanceByCadence(nextRunAt, brand.recurringScanCadence);
    guard += 1;
  }

  return count;
}

function advanceByCadence(date: Date, cadence: "weekly" | "daily" | null) {
  const next = new Date(date);
  if (cadence === "daily") {
    next.setDate(next.getDate() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

function cadenceLabel(cadence: "weekly" | "daily" | null) {
  if (cadence === "daily") return "dnevno";
  return "tedensko";
}

function ScanStatusBadge({ status }: { status: ScanRunStatus }) {
  if (status === "running") return <Badge variant="warning">running</Badge>;
  if (status === "failed") return <Badge variant="danger">failed</Badge>;
  if (status === "completed") return <Badge variant="success">completed</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function EmailStatusBadge({ type }: { type: EmailEventType }) {
  if (type === "sent") return <Badge variant="success">sent</Badge>;
  if (type === "failed") return <Badge variant="danger">failed</Badge>;
  if (type === "queued") return <Badge variant="warning">queued</Badge>;
  return <Badge variant="secondary">{type}</Badge>;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}
