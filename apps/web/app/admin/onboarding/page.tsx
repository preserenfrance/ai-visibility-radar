import { redirect } from "next/navigation";
import type React from "react";
import {
  AlertTriangle,
  Repeat2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { getAdminOnboardingAnalytics } from "@/lib/onboarding";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/onboarding");
  if (!isAdminUser(user))
    return (
      <main className="p-8">You do not have access to the admin area.</main>
    );

  const analytics = await getAdminOnboardingAnalytics();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <Target className="h-5 w-5" />
          Admin onboarding
        </div>
        <h1 className="text-3xl font-semibold">Activation analytics</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          User progress from signup to deeper, repeated use of AI Visibility
          Radar.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Users"
          value={analytics.totalUsers}
          detail={`${analytics.recentlyActiveRate}% active in 7d`}
        />
        <MetricCard
          icon={<Target className="h-5 w-5" />}
          label="Activated"
          value={`${analytics.activationRate}%`}
          detail={`${analytics.activatedUsers}/${analytics.totalUsers} users`}
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Deep usage"
          value={`${analytics.deepUsageRate}%`}
          detail={`${analytics.deepUsers} users`}
        />
        <MetricCard
          icon={<Repeat2 className="h-5 w-5" />}
          label="Repeated"
          value={`${analytics.repeatRate}%`}
          detail={`${analytics.repeatUsers} users`}
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Needs help"
          value={analytics.atRiskUsers}
          detail="no brand, scan or recent return"
          tone={analytics.atRiskUsers > 0 ? "warning" : "default"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Onboarding funnel</CardTitle>
          <CardDescription>
            Derived from product data: brands, scans, prompts, competitors,
            reviews and recurring measurement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {analytics.funnel.map((step) => (
              <div key={step.key} className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium">{step.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {step.count.toLocaleString("en-US")} users ·{" "}
                    {step.conversionPercent}%
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${step.conversionPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Signup cohorts</CardTitle>
            <CardDescription>
              Weekly cohorts over the last eight weeks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Week</TH>
                  <TH>Users</TH>
                  <TH>Activated</TH>
                  <TH>Deep</TH>
                  <TH>Repeated</TH>
                </TR>
              </THead>
              <TBody>
                {analytics.cohorts.map((cohort) => (
                  <TR key={cohort.key}>
                    <TD>{cohort.label}</TD>
                    <TD>{cohort.users}</TD>
                    <TD>{cohort.activationRate}%</TD>
                    <TD>{cohort.deepUsageRate}%</TD>
                    <TD>{cohort.repeatRate}%</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users needing a nudge</CardTitle>
            <CardDescription>
              Lowest onboarding progress first, with the next unfinished step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Progress</TH>
                  <TH>Next step</TH>
                  <TH>Brand</TH>
                  <TH>Last seen</TH>
                </TR>
              </THead>
              <TBody>
                {analytics.usersNeedingHelp.map((item) => (
                  <TR key={item.userId}>
                    <TD>
                      <div className="font-medium">{item.email}</div>
                      {item.name && (
                        <div className="text-xs text-muted-foreground">
                          {item.name}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <Badge
                        variant={progressBadgeVariant(item.completionPercent)}
                      >
                        {item.completionPercent}%
                      </Badge>
                    </TD>
                    <TD>{item.nextStep?.title ?? "-"}</TD>
                    <TD>{item.primaryBrandName ?? "-"}</TD>
                    <TD>{formatDate(item.lastSeenAt)}</TD>
                  </TR>
                ))}
                {analytics.usersNeedingHelp.length === 0 && (
                  <TR>
                    <TD colSpan={5} className="text-muted-foreground">
                      Every user has completed the current onboarding path.
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

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-300" : undefined}>
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
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function progressBadgeVariant(value: number) {
  if (value >= 80) return "success";
  if (value >= 50) return "warning";
  return "secondary";
}
