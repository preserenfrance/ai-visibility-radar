import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, MessageSquare, Users } from "lucide-react";
import { prisma, type Plan } from "@ai-radar/db";
import { PLAN_LIMITS } from "@ai-radar/usage";
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
import { getCurrentUser, isAdminUser, requireAdminUser } from "@/lib/auth";
import {
  activateRecurringScansForOrganizationPlan,
  deactivateRecurringScansForOrganization,
} from "@/lib/services";

export const dynamic = "force-dynamic";

const activePlans: Plan[] = ["free", "starter", "growth"];
const planOptions: Plan[] = ["free", "starter", "growth", "disabled"];
const GROWTH_WINDOW_DAYS = 30;

async function updateAccountPlan(formData: FormData) {
  "use server";
  await requireAdminUser();

  const organizationId = String(formData.get("organizationId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!organizationId || !isPlan(plan))
    throw new Error("Bad Request: neveljaven account plan");

  await setOrganizationPlan(organizationId, plan);

  redirect("/admin?updated=1");
}

async function deactivateAccountPlan(formData: FormData) {
  "use server";
  await requireAdminUser();

  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Bad Request: missing organization");

  await setOrganizationPlan(organizationId, "disabled");

  redirect("/admin?updated=disabled");
}

async function setOrganizationPlan(organizationId: string, plan: Plan) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan },
  });

  const billingStatus =
    plan === "starter" || plan === "growth" ? "active" : "canceled";
  await prisma.billingSubscription.upsert({
    where: { organizationId },
    update: {
      plan,
      status: billingStatus,
    },
    create: {
      organizationId,
      plan,
      status: billingStatus,
    },
  });

  if (plan === "disabled") {
    await deactivateRecurringScansForOrganization(organizationId);
    await cancelActiveScansForOrganization(organizationId);
    return;
  }

  await activateRecurringScansForOrganizationPlan(organizationId, plan);
}

async function cancelActiveScansForOrganization(organizationId: string) {
  const canceledAt = new Date();
  await prisma.$transaction([
    prisma.promptRun.updateMany({
      where: {
        status: { in: ["queued", "running"] },
        scanRun: {
          status: { in: ["queued", "running"] },
          brand: { organizationId },
        },
      },
      data: {
        status: "skipped",
        finishedAt: canceledAt,
        errorMessage: "Canceled because the plan was deactivated.",
      },
    }),
    prisma.scanRun.updateMany({
      where: {
        status: { in: ["queued", "running"] },
        brand: { organizationId },
      },
      data: {
        status: "canceled",
        finishedAt: canceledAt,
      },
    }),
  ]);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login?next=/admin");
  if (!isAdminUser(currentUser))
    return (
      <main className="p-8">You do not have access to the admin area.</main>
    );

  const params = await searchParams;
  const now = new Date();
  const growthDays = lastDays(GROWTH_WINDOW_DAYS, now);
  const activeLeadWhere = {
    OR: [
      { organizationId: null },
      { organization: { is: { plan: { not: "disabled" as const } } } },
    ],
  };
  const [users, organizations, activeBrands, leadCount, leads] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          memberships: {
            orderBy: { createdAt: "asc" },
            include: {
              organization: {
                include: {
                  billingSubscription: true,
                  _count: { select: { brands: true } },
                },
              },
            },
          },
        },
      }),
      prisma.organization.findMany({
        where: { plan: { not: "disabled" } },
        orderBy: { createdAt: "desc" },
        include: {
          billingSubscription: true,
          _count: { select: { brands: true, memberships: true } },
        },
      }),
      prisma.brand.findMany({
        where: {
          organization: { plan: { not: "disabled" } },
        },
        select: { createdAt: true },
      }),
      prisma.lead.count({ where: activeLeadWhere }),
      prisma.lead.findMany({
        where: activeLeadWhere,
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          auditScanRun: {
            include: {
              scoreSnapshot: true,
            },
          },
        },
      }),
    ]);

  const visibleUsers = users.filter((user) => {
    const activeMemberships = activeOrganizationMemberships(user.memberships);
    return activeMemberships.length > 0 || user.memberships.length === 0;
  });
  const totalBrands = activeBrands.length;
  const planSummaries = activePlans.map((plan) => {
    const planOrganizations = organizations.filter(
      (organization) => organization.plan === plan,
    );
    return {
      plan,
      organizations: planOrganizations.length,
      users: planOrganizations.reduce(
        (sum, organization) => sum + organization._count.memberships,
        0,
      ),
      brands: planOrganizations.reduce(
        (sum, organization) => sum + organization._count.brands,
        0,
      ),
    };
  });
  const growthSeries = [
    {
      key: "users",
      label: `Users (${visibleUsers.length.toLocaleString("en-US")})`,
      color: "#0f766e",
    },
    {
      key: "organizations",
      label: `Organizations (${organizations.length.toLocaleString("en-US")})`,
      color: "#2563eb",
    },
    {
      key: "brands",
      label: `Brands (${totalBrands.toLocaleString("en-US")})`,
      color: "#d97706",
    },
  ];
  const growthPoints = buildAccountGrowthPoints({
    days: growthDays,
    users: visibleUsers.map((user) => user.createdAt),
    organizations: organizations.map((organization) => organization.createdAt),
    brands: activeBrands.map((brand) => brand.createdAt),
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Users className="h-5 w-5" />
            Admin
          </div>
          <h1 className="text-3xl font-semibold">Users and plans</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Unified overview of users, organizations, plans, billing statuses
            and latest leads.
          </p>
        </div>
        {params?.updated && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            Account nivo je posodobljen.
          </div>
        )}
        <Button asChild variant="outline">
          <Link href="/admin/ai-chats">
            <MessageSquare className="h-4 w-4" />
            AI chats
          </Link>
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Active users" value={visibleUsers.length} />
        <MetricCard label="Active organizations" value={organizations.length} />
        <MetricCard label="Active brands" value={totalBrands} />
        <MetricCard label="Leads" value={leadCount} />
      </div>

      <MentionsTrendChart
        title="Account growth"
        description={`Active cumulative totals over the last ${GROWTH_WINDOW_DAYS} days. Deactivated accounts are excluded from every series.`}
        series={growthSeries}
        points={growthPoints}
        promptMarkers={[]}
        emptyMessage="No active users, organizations or brands in this period."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {planSummaries.map((summary) => (
          <Card key={summary.plan}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <PlanBadge plan={summary.plan} />
                <span className="text-sm text-muted-foreground">
                  {PLAN_LIMITS[summary.plan].scanCadence}
                </span>
              </CardTitle>
              <CardDescription>Plan {summary.plan}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <InlineMetric label="Org." value={summary.organizations} />
                <InlineMetric label="Users" value={summary.users} />
                <InlineMetric label="Brands" value={summary.brands} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Users, organizations and account level</CardTitle>
          <CardDescription>
            Each row represents a user membership in an organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Registered</TH>
                <TH>Organization</TH>
                <TH>Status</TH>
                <TH>Brands</TH>
                <TH>Level</TH>
                <TH>Billing</TH>
                <TH>Spremeni account</TH>
              </TR>
            </THead>
            <TBody>
              {visibleUsers.flatMap((user) => {
                const memberships = activeOrganizationMemberships(
                  user.memberships,
                );
                if (memberships.length === 0) {
                  return (
                    <TR key={user.id}>
                      <TD>
                        <div className="font-medium">{user.email}</div>
                        {user.name && (
                          <div className="text-xs text-muted-foreground">
                            {user.name}
                          </div>
                        )}
                      </TD>
                      <TD>{user.createdAt.toLocaleString("en-US")}</TD>
                      <TD>No organization</TD>
                      <TD>
                        <Badge variant="secondary">brez accounta</Badge>
                      </TD>
                      <TD>0</TD>
                      <TD>
                        <Badge variant="secondary">-</Badge>
                      </TD>
                      <TD>-</TD>
                      <TD>-</TD>
                    </TR>
                  );
                }

                return memberships.map((membership, index) => {
                  const organization = membership.organization;
                  const limits = PLAN_LIMITS[organization.plan];
                  return (
                    <TR key={`${user.id}-${organization.id}`}>
                      <TD>
                        <div className="font-medium">{user.email}</div>
                        {user.name && (
                          <div className="text-xs text-muted-foreground">
                            {user.name}
                          </div>
                        )}
                        {index > 0 && (
                          <div className="text-xs text-muted-foreground">
                            additional organization
                          </div>
                        )}
                      </TD>
                      <TD>{user.createdAt.toLocaleString("en-US")}</TD>
                      <TD>
                        <div className="font-medium">{organization.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {membership.role}
                        </div>
                      </TD>
                      <TD>
                        <AccountStatusBadge plan={organization.plan} />
                      </TD>
                      <TD>
                        {organization._count.brands} / {limits.brandCount}
                      </TD>
                      <TD>
                        <PlanBadge plan={organization.plan} />
                      </TD>
                      <TD>
                        <BillingBadge organization={organization} />
                      </TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-2">
                          <form
                            action={updateAccountPlan}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="organizationId"
                              value={organization.id}
                            />
                            <select
                              name="plan"
                              defaultValue={organization.plan}
                              className="h-9 rounded-md border bg-background px-3 text-sm"
                            >
                              {planOptions.map((plan) => (
                                <option key={plan} value={plan}>
                                  {plan}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="outline">
                              Save
                            </Button>
                          </form>
                          {organization.plan !== "disabled" && (
                            <form action={deactivateAccountPlan}>
                              <input
                                type="hidden"
                                name="organizationId"
                                value={organization.id}
                              />
                              <Button
                                type="submit"
                                size="sm"
                                variant="destructive"
                              >
                                Deactivate
                              </Button>
                            </form>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                });
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Latest leads
              </CardTitle>
              <CardDescription>
                Latest 20 leads from the free audit.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/leads">All leads</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Domain</TH>
                <TH>Brand</TH>
                <TH>AI Visibility Score</TH>
                <TH>Lead score</TH>
                <TH>Created</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {leads.map((lead) => (
                <TR key={lead.id}>
                  <TD>
                    <Link
                      className="font-medium text-primary"
                      href={`/admin/leads/${lead.id}`}
                    >
                      {lead.email}
                    </Link>
                  </TD>
                  <TD>{lead.domain}</TD>
                  <TD>{lead.brandName}</TD>
                  <TD>
                    {lead.auditScanRun?.scoreSnapshot?.visibilityScore ?? "-"}
                  </TD>
                  <TD>{lead.leadScore}</TD>
                  <TD>{lead.createdAt.toLocaleString("en-US")}</TD>
                  <TD>
                    <Badge variant="secondary">{lead.status}</Badge>
                  </TD>
                </TR>
              ))}
              {leads.length === 0 && (
                <TR>
                  <TD colSpan={7} className="text-muted-foreground">
                    No leads have been captured.
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">
          {value.toLocaleString("en-US")}
        </div>
      </CardContent>
    </Card>
  );
}

function InlineMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">
        {value.toLocaleString("en-US")}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === "disabled") return <Badge variant="danger">disabled</Badge>;
  if (plan === "growth") return <Badge>growth</Badge>;
  if (plan === "starter") return <Badge variant="warning">starter</Badge>;
  return <Badge variant="secondary">free</Badge>;
}

function AccountStatusBadge({ plan }: { plan: Plan }) {
  if (plan === "disabled") return <Badge variant="danger">disabled</Badge>;
  return <Badge variant="success">active</Badge>;
}

function BillingBadge({
  organization,
}: {
  organization: {
    plan: Plan;
    billingSubscription?: {
      status: string | null;
      stripeSubscriptionId?: string | null;
    } | null;
  };
}) {
  const subscription = organization.billingSubscription;
  if (organization.plan === "disabled") {
    return <Badge variant="danger">disabled</Badge>;
  }
  if (organization.plan !== "free" && !subscription?.stripeSubscriptionId) {
    return <Badge variant="success">manually active</Badge>;
  }
  if (subscription?.stripeSubscriptionId) {
    const status = subscription.status ?? "no status";
    return (
      <Badge
        variant={
          status === "active"
            ? "success"
            : status === "trialing"
              ? "warning"
              : "secondary"
        }
      >
        Stripe: {status}
      </Badge>
    );
  }
  return <Badge variant="secondary">inactive</Badge>;
}

function isPlan(value: string): value is Plan {
  return (
    value === "free" ||
    value === "starter" ||
    value === "growth" ||
    value === "disabled"
  );
}

function activeOrganizationMemberships<
  T extends { organization: { plan: Plan } },
>(memberships: T[]) {
  return memberships.filter((membership) =>
    isActivePlan(membership.organization.plan),
  );
}

function isActivePlan(plan: Plan) {
  return plan !== "disabled";
}

function lastDays(count: number, now: Date) {
  const end = startOfDay(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (count - index - 1));
    return {
      date,
      key: dayKey(date),
      label: `${date.getDate()}.${date.getMonth() + 1}.`,
    };
  });
}

function buildAccountGrowthPoints({
  days,
  users,
  organizations,
  brands,
}: {
  days: Array<{ date: Date; key: string; label: string }>;
  users: Date[];
  organizations: Date[];
  brands: Date[];
}) {
  return days.map((day) => {
    const end = endOfDay(day.date);
    return {
      date: day.key,
      label: day.label,
      values: {
        users: countCreatedBy(users, end),
        organizations: countCreatedBy(organizations, end),
        brands: countCreatedBy(brands, end),
      },
    };
  });
}

function countCreatedBy(dates: Date[], end: Date) {
  return dates.filter((date) => date <= end).length;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
