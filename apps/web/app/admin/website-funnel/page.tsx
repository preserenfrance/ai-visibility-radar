import Link from "next/link";
import { redirect } from "next/navigation";
import type React from "react";
import {
  ArrowRight,
  ClipboardList,
  MousePointerClick,
  PlayCircle,
  Tags,
  Users,
} from "lucide-react";
import { MentionsTrendChart } from "@/components/mentions-trend-chart";
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
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { getWebsiteFunnelAnalytics } from "@/lib/website-analytics";

export const dynamic = "force-dynamic";

export default async function WebsiteFunnelPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login?next=/admin/website-funnel");
  if (!isAdminUser(currentUser)) {
    return (
      <main className="p-8">You do not have access to the admin area.</main>
    );
  }

  const analytics = await getWebsiteFunnelAnalytics();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <MousePointerClick className="h-5 w-5" />
            Admin analytics
          </div>
          <h1 className="text-3xl font-semibold">Website funnel</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Website visits, pricing interest, free audit starts and upgrade
            intent over the last {analytics.windowDays} days.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Website visitors"
          value={analytics.totals.websiteVisitors}
          detail={`${analytics.totals.websitePageViews} page views`}
        />
        <MetricCard
          icon={<Tags className="h-5 w-5" />}
          label="Pricing"
          value={analytics.totals.pricingVisitors}
          detail={`${analytics.totals.pricingViews} views · ${analytics.rates.pricingViewRate}% of visitors`}
        />
        <MetricCard
          icon={<PlayCircle className="h-5 w-5" />}
          label="Free audit starts"
          value={analytics.totals.freeAuditStarts}
          detail={`${analytics.rates.freeAuditStartRate}% of visitors`}
        />
        <MetricCard
          icon={<MousePointerClick className="h-5 w-5" />}
          label="Upgrade clicks"
          value={analytics.totals.upgradeClicks}
          detail={`${analytics.totals.checkoutStarts} checkouts started`}
        />
      </div>

      <MentionsTrendChart
        title="Funnel trend"
        description={`Daily website visitors, pricing views, free audit starts and upgrade button clicks over the last ${analytics.windowDays} days.`}
        series={analytics.chart.series}
        points={analytics.chart.points}
        promptMarkers={[]}
        emptyMessage="No website analytics events have been recorded in this period."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <ConversionCard
          title="Visitor to pricing"
          value={`${analytics.rates.pricingViewRate}%`}
          detail={`${analytics.totals.pricingVisitors} pricing visitors from ${analytics.totals.websiteVisitors} website visitors`}
        />
        <ConversionCard
          title="Visitor to free audit"
          value={`${analytics.rates.freeAuditStartRate}%`}
          detail={`${analytics.totals.freeAuditStarts} successful starts · ${analytics.totals.validFreeAuditClicks} valid CTA clicks`}
        />
        <ConversionCard
          title="Pricing to upgrade click"
          value={`${analytics.rates.pricingToUpgradeClickRate}%`}
          detail={`${analytics.totals.upgradeClickVisitors} upgrade click visitors · ${analytics.rates.upgradeClickToCheckoutRate}% click to checkout`}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="Upgrade clicks by plan"
          empty="No upgrade clicks yet."
          rows={analytics.upgradeBreakdown}
        />
        <BreakdownCard
          title="Upgrade clicks by location"
          empty="No upgrade clicks yet."
          rows={analytics.upgradeLocations}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="Free audit CTA locations"
          empty="No free audit clicks yet."
          rows={analytics.freeAuditLocations}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Top website pages
            </CardTitle>
            <CardDescription>
              Public marketing pages with the most page views.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Page</TH>
                  <TH>Views</TH>
                </TR>
              </THead>
              <TBody>
                {analytics.topPages.map((page) => (
                  <TR key={page.path}>
                    <TD>
                      <Link
                        className="font-medium text-primary"
                        href={page.path}
                      >
                        {page.path}
                      </Link>
                    </TD>
                    <TD>{page.views.toLocaleString("en-US")}</TD>
                  </TR>
                ))}
                {analytics.topPages.length === 0 && (
                  <TR>
                    <TD colSpan={2} className="text-muted-foreground">
                      No page views yet.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest free audit starts</CardTitle>
          <CardDescription>
            Successful free audit submissions from the tracked funnel window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Domain</TH>
                <TH>Brand</TH>
                <TH>Created</TH>
                <TH>Lead</TH>
              </TR>
            </THead>
            <TBody>
              {analytics.latestFreeAuditLeads.map((lead) => (
                <TR key={lead.id}>
                  <TD>{lead.email}</TD>
                  <TD>{lead.domain}</TD>
                  <TD>{lead.brandName}</TD>
                  <TD>{lead.createdAt.toLocaleString("en-US")}</TD>
                  <TD>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/leads/${lead.id}`}>
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TD>
                </TR>
              ))}
              {analytics.latestFreeAuditLeads.length === 0 && (
                <TR>
                  <TD colSpan={5} className="text-muted-foreground">
                    No free audit starts in this period.
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
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">
          {value.toLocaleString("en-US")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function ConversionCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <Badge>{value}</Badge>
        </CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function BreakdownCard({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ label: string; count: number }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {total.toLocaleString("en-US")} recorded clicks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Segment</TH>
              <TH>Clicks</TH>
              <TH>Share</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.label}>
                <TD>{row.label}</TD>
                <TD>{row.count.toLocaleString("en-US")}</TD>
                <TD>
                  {total > 0 ? Math.round((row.count / total) * 100) : 0}%
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={3} className="text-muted-foreground">
                  {empty}
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
