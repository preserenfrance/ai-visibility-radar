import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { AlertTriangle, PackageSearch, Sparkles } from "lucide-react";
import { BrandInsightSubmitButton } from "@/components/brand-insight-submit-button";
import { BrandMenu } from "@/components/brand-menu";
import { MetricCard } from "@/components/metric-card";
import {
  MentionsTrendChart,
  type MentionTrendPoint,
  type MentionTrendSeries,
  type PromptAdditionMarker,
} from "@/components/mentions-trend-chart";
import { ProviderScanForm } from "@/components/provider-scan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";
import { selectedEngineVariantsFromFormData } from "@/lib/ai-providers";
import { canRunAutomaticScans, canRunManualScans } from "@/lib/billing";
import {
  createScanForBrand,
  generateBrandCustomerConcernsSummary,
  generateBrandChatGptSummary,
  generateBrandProductSummary,
  manualScanUsageForOrganization,
} from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MENTION_TREND_SERIES: MentionTrendSeries[] = [
  { key: "openai:base", label: "ChatGPT", color: "#2563eb" },
  { key: "openai:search", label: "ChatGPT + search", color: "#0f766e" },
  { key: "google:base", label: "Gemini", color: "#7c3aed" },
  { key: "google:search", label: "Gemini + search", color: "#c026d3" },
  { key: "anthropic:base", label: "Claude", color: "#ea580c" },
  { key: "anthropic:search", label: "Claude + search", color: "#dc2626" },
];

const MENTIONED_DOMAIN_COLORS = [
  "#0891b2",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#4f46e5",
  "#0d9488",
  "#9333ea",
  "#ca8a04",
  "#be123c",
  "#15803d",
];

async function startProviderScan(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const { user, brand } = await requireBrandAccess(brandId);
  const manualScanAccess = canRunManualScans(brand.organization);
  const scan = await createScanForBrand(brandId, {
    engineVariants: manualScanAccess
      ? selectedEngineVariantsFromFormData(formData)
      : [{ provider: "openai", searchEnabled: false }],
    runNow: false,
    initiatedByUserId: user.id,
  });
  redirect(`/app/brands/${brandId}/scans/${scan?.id}`);
}

type BrandInsightType = "summary" | "customerConcerns" | "products";

async function refreshBrandChatGptInsight(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const insight = String(formData.get("insight") ?? "");
  if (!isBrandInsightType(insight)) {
    throw new Error("Bad Request: invalid brand insight");
  }
  const { brand } = await requireBrandAccess(brandId);
  const input = {
    name: brand.name,
    domain: brand.domain,
    description: brand.description,
    industry: brand.industry,
    country: brand.country,
    language: brand.language,
  };

  try {
    const now = new Date();
    const summary =
      insight === "summary"
        ? await generateBrandChatGptSummary(input)
        : insight === "customerConcerns"
          ? await generateBrandCustomerConcernsSummary(input)
          : await generateBrandProductSummary(input);

    await prisma.brand.update({
      where: { id: brandId },
      data: brandInsightUpdateData(insight, summary, now),
    });
  } catch (error) {
    console.error("ChatGPT brand insight refresh failed", error);
    redirect(`/app/brands/${brandId}?brandInsight=error`);
  }

  redirect(`/app/brands/${brandId}`);
}

function isBrandInsightType(value: string): value is BrandInsightType {
  return (
    value === "summary" || value === "customerConcerns" || value === "products"
  );
}

function brandInsightUpdateData(
  insight: BrandInsightType,
  summary: string | null,
  now: Date,
) {
  if (insight === "summary") {
    return {
      chatGptBrandSummary: summary,
      chatGptBrandSummaryUpdatedAt: summary ? now : null,
    };
  }
  if (insight === "customerConcerns") {
    return {
      chatGptCustomerConcernsSummary: summary,
      chatGptCustomerConcernsSummaryUpdatedAt: summary ? now : null,
    };
  }
  return {
    chatGptProductSummary: summary,
    chatGptProductSummaryUpdatedAt: summary ? now : null,
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ brandInsight?: string; brandSummary?: string }>;
}) {
  const { brandId } = await params;
  const query = await searchParams;
  await requireBrandAccess(brandId);
  const trendDays = mentionTrendDays();
  const trendStart = trendDays[0]?.date ?? new Date();
  const [brand, mentionTrendScanRuns, promptAdditions] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        organization: { include: { billingSubscription: true } },
        competitors: true,
        scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 2 },
        promptSets: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { prompts: true },
        },
        scanRuns: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            scoreSnapshot: true,
            promptRuns: {
              include: {
                engine: true,
                aiResponse: { include: { parsedResult: true } },
              },
            },
          },
        },
      },
    }),
    prisma.scanRun.findMany({
      where: {
        brandId,
        createdAt: { gte: trendStart },
      },
      orderBy: { createdAt: "asc" },
      include: {
        promptRuns: {
          include: {
            engine: true,
            aiResponse: { include: { parsedResult: true, citations: true } },
          },
        },
      },
    }),
    prisma.prompt.findMany({
      where: {
        createdAt: { gte: trendStart },
        promptSet: { brandId },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    }),
  ]);
  if (!brand) return null;

  const latestScan = brand.scanRuns[0];
  const latestScore = brand.scoreSnapshots[0];
  const promptSet = brand.promptSets[0];
  const manualScanAccess = canRunManualScans(brand.organization);
  const automaticScanAccess = canRunAutomaticScans(brand.organization);
  const recurringScanActive = brand.recurringScanActive && automaticScanAccess;
  const recurringScanScheduled = automaticScanAccess;
  const brandInsightError =
    query?.brandInsight === "error" || query?.brandSummary === "error";
  const mentionedDomainSeries = buildMentionedDomainSeries(
    mentionTrendScanRuns,
    brand.domain,
  );
  const brandMentionTrendPoints = buildMentionTrendPoints(
    trendDays,
    mentionTrendScanRuns,
    [],
    brand.domain,
  );
  const competitorMentionTrendPoints = buildMentionTrendPoints(
    trendDays,
    mentionTrendScanRuns,
    mentionedDomainSeries,
    brand.domain,
  );
  const promptAdditionMarkers = buildPromptAdditionMarkers(
    trendDays,
    promptAdditions,
  );
  const manualScanUsage = await manualScanUsageForOrganization(
    brand.organizationId,
    brand.organization.plan,
  );

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <BrandMenu brandId={brand.id} active="overview" />

      <section className="mb-6 rounded-md border bg-card px-5 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold">{brand.name}</h1>
              <Badge variant="secondary">{brand.country}</Badge>
              <Badge variant="secondary">{brand.language}</Badge>
              {brand.industry && <Badge>{brand.industry}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{brand.domain}</p>
          </div>

          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[620px]">
            <CompactBrandFact
              label="Competitors"
              value={brand.competitors.length}
            />
            <CompactBrandFact
              label="Prompts"
              value={promptSet?.prompts.length ?? 0}
            />
            <CompactBrandFact
              label="Recurring scan"
              value={
                recurringScanScheduled
                  ? cadenceLabel(brand.recurringScanCadence ?? "weekly")
                  : "inactive"
              }
              detail={
                recurringScanScheduled && brand.recurringScanNextRunAt
                  ? brand.recurringScanNextRunAt.toLocaleString("en-US")
                  : recurringScanActive
                    ? "run is being scheduled"
                    : undefined
              }
            />
            <CompactBrandFact
              label="Manual scans"
              value={`${manualScanUsage.remaining}/${manualScanUsage.limit}`}
              detail={`reset ${manualScanUsage.resetAt.toLocaleDateString("en-US")}`}
            />
          </div>
        </div>

        <div className="mt-4 grid divide-y overflow-hidden rounded-md border bg-background lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <BrandInsightPanel
            brandId={brand.id}
            insight="summary"
            icon="summary"
            title="ChatGPT brand view"
            value={brand.chatGptBrandSummary}
            updatedAt={brand.chatGptBrandSummaryUpdatedAt}
            emptyText="This view is not ready yet."
          />
          <BrandInsightPanel
            brandId={brand.id}
            insight="customerConcerns"
            icon="concerns"
            title="What dissatisfied customers dislike"
            value={brand.chatGptCustomerConcernsSummary}
            updatedAt={brand.chatGptCustomerConcernsSummaryUpdatedAt}
            emptyText="Public complaints are not ready yet."
          />
          <BrandInsightPanel
            brandId={brand.id}
            insight="products"
            icon="products"
            title="Key products and offer"
            value={brand.chatGptProductSummary}
            updatedAt={brand.chatGptProductSummaryUpdatedAt}
            emptyText="The offer summary is not ready yet."
          />
        </div>
        {brandInsightError && (
          <p className="mt-3 text-xs text-destructive">
            The ChatGPT insight could not be prepared right now. Check OpenAI
            nastavitev ali poskusi ponovno.
          </p>
        )}
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          metric="visibility"
          value={latestScore?.visibilityScore ?? 0}
        />
        <MetricCard metric="mentions" value={latestScore?.mentionScore ?? 0} />
        <MetricCard
          metric="shareOfVoice"
          value={latestScore?.shareOfVoiceScore ?? 0}
        />
        <MetricCard metric="accuracy" value={latestScore?.accuracyScore ?? 0} />
      </div>

      <MentionsTrendChart
        title="Our mentions over time"
        description="Last 30 days by model; markers on the chart show added prompts."
        series={MENTION_TREND_SERIES}
        points={brandMentionTrendPoints}
        promptMarkers={promptAdditionMarkers}
        emptyMessage="No own-brand mentions have been recorded in the last 30 days."
      />

      <MentionsTrendChart
        title="Competitor mentions over time"
        description="Top 10 most frequently mentioned external domains in AI answer citations."
        series={[]}
        domainSeries={mentionedDomainSeries}
        points={competitorMentionTrendPoints}
        promptMarkers={promptAdditionMarkers}
        domainSeriesLabel="Most mentioned competitor domains"
        emptyMessage="No competitor domains have been recorded in the last 30 days."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Breakdown by model</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Model</TH>
                <TH>Runs</TH>
                <TH>Mentions</TH>
                <TH>Errors</TH>
              </TR>
            </THead>
            <TBody>
              {Object.entries(
                engineBreakdown(latestScan?.promptRuns ?? []),
              ).map(([engine, item]) => (
                <TR key={engine}>
                  <TD>{engine}</TD>
                  <TD>{item.total}</TD>
                  <TD>{item.mentioned}</TD>
                  <TD>{item.failed}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Latest scans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Started</TH>
                <TH>Status</TH>
                <TH>Visibility</TH>
                <TH>Runs</TH>
              </TR>
            </THead>
            <TBody>
              {brand.scanRuns.map((scan) => (
                <TR key={scan.id}>
                  <TD>
                    <a
                      className="text-primary"
                      href={`/app/brands/${brand.id}/scans/${scan.id}`}
                    >
                      {scan.createdAt.toLocaleString("en-US")}
                    </a>
                  </TD>
                  <TD>
                    <Badge variant={statusBadgeVariant(scan.status)}>
                      {statusLabel(scan.status)}
                    </Badge>
                  </TD>
                  <TD>{scan.scoreSnapshot?.visibilityScore ?? "-"}</TD>
                  <TD>
                    {scan.completedPromptRuns}/{scan.totalPromptRuns}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <ProviderScanForm
        brandId={brand.id}
        action={startProviderScan}
        manualScanAccess={manualScanAccess}
        manualScanUsage={{
          used: manualScanUsage.used,
          limit: manualScanUsage.limit,
          remaining: manualScanUsage.remaining,
          resetLabel: manualScanUsage.resetAt.toLocaleDateString("en-US"),
        }}
        compact
      />
    </section>
  );
}

function CompactBrandFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold">{value}</div>
      {detail && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {detail}
        </div>
      )}
    </div>
  );
}

type BrandInsightIcon = "summary" | "concerns" | "products";

function BrandInsightPanel({
  brandId,
  insight,
  icon,
  title,
  value,
  updatedAt,
  emptyText,
}: {
  brandId: string;
  insight: BrandInsightType;
  icon: BrandInsightIcon;
  title: string;
  value: string | null;
  updatedAt: Date | null;
  emptyText: string;
}) {
  const Icon = brandInsightIcon(icon);

  return (
    <section className="min-w-0 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-sm font-semibold">{title}</h2>
        </div>
        <form action={refreshBrandChatGptInsight}>
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="insight" value={insight} />
          <BrandInsightSubmitButton hasValue={Boolean(value)} />
        </form>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {value ?? emptyText}
      </p>
      {updatedAt && (
        <div className="mt-2 text-xs text-muted-foreground">
          {updatedAt.toLocaleString("en-US")}
        </div>
      )}
    </section>
  );
}

function brandInsightIcon(icon: BrandInsightIcon) {
  if (icon === "concerns") return AlertTriangle;
  if (icon === "products") return PackageSearch;
  return Sparkles;
}

type TrendDay = {
  date: Date;
  key: string;
  label: string;
};

type MentionTrendScanRun = {
  createdAt: Date;
  promptRuns: Array<{
    engine: {
      provider: string;
      searchEnabled: boolean;
    };
    aiResponse: {
      parsedResult: {
        brandMentioned: boolean;
        mentionCount: number;
        parsedJson: unknown;
      } | null;
      citations: Array<{
        domain: string;
        isOwnedDomain: boolean;
      }>;
    } | null;
  }>;
};

function mentionTrendDays(): TrendDay[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    return {
      date,
      key: dateKey(date),
      label: date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });
}

function buildMentionTrendPoints(
  days: TrendDay[],
  scanRuns: MentionTrendScanRun[],
  domainSeries: MentionTrendSeries[],
  brandDomain: string,
): MentionTrendPoint[] {
  const chartSeries = [...MENTION_TREND_SERIES, ...domainSeries];
  const domainKeys = new Set(domainSeries.map((series) => series.key));
  const points = new Map(
    days.map((day) => [
      day.key,
      {
        date: day.key,
        label: day.label,
        values: Object.fromEntries(
          chartSeries.map((series) => [series.key, 0]),
        ) as Record<string, number>,
      },
    ]),
  );

  for (const scanRun of scanRuns) {
    const point = points.get(dateKey(scanRun.createdAt));
    if (!point) continue;

    for (const promptRun of scanRun.promptRuns) {
      const key = engineSeriesKey(
        promptRun.engine.provider,
        promptRun.engine.searchEnabled,
      );
      if (key in point.values) {
        point.values[key] =
          (point.values[key] ?? 0) + mentionCountForPromptRun(promptRun);
      }

      if (domainKeys.size > 0) {
        for (const [domain, count] of domainCountsForPromptRun(
          promptRun,
          brandDomain,
        )) {
          const domainKey = mentionedDomainSeriesKey(domain);
          if (!domainKeys.has(domainKey)) continue;
          point.values[domainKey] = (point.values[domainKey] ?? 0) + count;
        }
      }
    }
  }

  return days.map((day) => points.get(day.key)!);
}

function buildMentionedDomainSeries(
  scanRuns: MentionTrendScanRun[],
  brandDomain: string,
): MentionTrendSeries[] {
  const totals = new Map<string, number>();

  for (const scanRun of scanRuns) {
    for (const promptRun of scanRun.promptRuns) {
      for (const [domain, count] of domainCountsForPromptRun(
        promptRun,
        brandDomain,
      )) {
        totals.set(domain, (totals.get(domain) ?? 0) + count);
      }
    }
  }

  return [...totals.entries()]
    .sort(
      ([leftDomain, leftCount], [rightDomain, rightCount]) =>
        rightCount - leftCount || leftDomain.localeCompare(rightDomain),
    )
    .slice(0, 10)
    .map(([domain, total], index) => ({
      key: mentionedDomainSeriesKey(domain),
      label: domain,
      color:
        MENTIONED_DOMAIN_COLORS[index % MENTIONED_DOMAIN_COLORS.length] ??
        "#64748b",
      total,
    }));
}

function domainCountsForPromptRun(
  promptRun: MentionTrendScanRun["promptRuns"][number],
  brandDomain: string,
) {
  const counts = new Map<string, number>();
  for (const citation of promptRun.aiResponse?.citations ?? []) {
    const domain = normalizeMentionedDomain(citation.domain);
    if (!domain) continue;
    if (citation.isOwnedDomain || isOwnedDomain(domain, brandDomain)) continue;

    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  return counts;
}

function normalizeMentionedDomain(value: string | null | undefined) {
  const domain = normalizeDomain(value ?? "");
  return domain || null;
}

function isOwnedDomain(domain: string, brandDomain: string) {
  const ownedDomain = normalizeMentionedDomain(brandDomain);
  if (!ownedDomain) return false;
  return domain === ownedDomain || domain.endsWith(`.${ownedDomain}`);
}

function mentionedDomainSeriesKey(domain: string) {
  return `domain:${domain}`;
}

function buildPromptAdditionMarkers(
  days: TrendDay[],
  prompts: Array<{ createdAt: Date }>,
): PromptAdditionMarker[] {
  const allowedDates = new Set(days.map((day) => day.key));
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    const key = dateKey(prompt.createdAt);
    if (!allowedDates.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return days
    .map((day) => {
      const count = counts.get(day.key) ?? 0;
      if (count === 0) return null;
      return {
        date: day.key,
        label: day.label,
        count,
      };
    })
    .filter((marker): marker is PromptAdditionMarker => Boolean(marker));
}

function mentionCountForPromptRun(
  promptRun: MentionTrendScanRun["promptRuns"][number],
) {
  const parsed = promptRun.aiResponse?.parsedResult;
  if (!parsed) return 0;
  if (parsed.mentionCount > 0) return parsed.mentionCount;

  const parsedJson = parsed.parsedJson as
    | { mentionCount?: unknown; brandMentioned?: unknown }
    | undefined;
  if (typeof parsedJson?.mentionCount === "number") {
    return Math.max(0, parsedJson.mentionCount);
  }
  return parsed.brandMentioned || parsedJson?.brandMentioned === true ? 1 : 0;
}

function engineSeriesKey(provider: string, searchEnabled: boolean) {
  return `${provider}:${searchEnabled ? "search" : "base"}`;
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function engineBreakdown(promptRuns: Array<any>) {
  return promptRuns.reduce<
    Record<string, { total: number; mentioned: number; failed: number }>
  >((acc, run) => {
    const engine = run.engine.engineName;
    const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
    const bucket = (acc[engine] ??= { total: 0, mentioned: 0, failed: 0 });
    bucket.total += 1;
    if (parsed?.brandMentioned) bucket.mentioned += 1;
    if (run.status === "failed") bucket.failed += 1;
    return acc;
  }, {});
}

function cadenceLabel(value: "weekly" | "daily" | null) {
  if (value === "daily") return "daily";
  if (value === "weekly") return "weekly";
  return "scheduled";
}

function statusLabel(status: string) {
  switch (status) {
    case "queued":
    case "running":
      return "in progress";
    case "completed":
      return "completed";
    case "failed":
      return "error";
    case "canceled":
      return "canceled";
    default:
      return status;
  }
}

function statusBadgeVariant(status: string) {
  if (status === "queued" || status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "secondary";
}
