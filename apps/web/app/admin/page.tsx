import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Users } from "lucide-react";
import { prisma, type Plan } from "@ai-radar/db";
import { PLAN_LIMITS } from "@ai-radar/usage";
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
import { activateRecurringScansForOrganizationPlan } from "@/lib/services";

export const dynamic = "force-dynamic";

const plans: Plan[] = ["free", "starter", "growth"];

async function updateAccountPlan(formData: FormData) {
  "use server";
  await requireAdminUser();

  const organizationId = String(formData.get("organizationId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!organizationId || !isPlan(plan))
    throw new Error("Bad Request: neveljaven account plan");

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan },
  });

  await prisma.billingSubscription.upsert({
    where: { organizationId },
    update: {
      plan,
      status: plan === "free" ? "canceled" : "active",
    },
    create: {
      organizationId,
      plan,
      status: plan === "free" ? "canceled" : "active",
    },
  });

  await activateRecurringScansForOrganizationPlan(organizationId, plan);

  redirect("/admin?updated=1");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login?next=/admin");
  if (!isAdminUser(currentUser))
    return <main className="p-8">Nimate dostopa do admin strani.</main>;

  const params = await searchParams;
  const [users, organizations, leadCount, leads] = await Promise.all([
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
      orderBy: { createdAt: "desc" },
      include: {
        billingSubscription: true,
        _count: { select: { brands: true, memberships: true } },
      },
    }),
    prisma.lead.count(),
    prisma.lead.findMany({
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

  const totalBrands = organizations.reduce(
    (sum, organization) => sum + organization._count.brands,
    0,
  );
  const planSummaries = plans.map((plan) => {
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

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Users className="h-5 w-5" />
            Admin
          </div>
          <h1 className="text-3xl font-semibold">Uporabniki in paketi</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Enoten pregled uporabnikov, organizacij, paketov, billing statusov
            in zadnjih leadov.
          </p>
        </div>
        {params?.updated && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            Account nivo je posodobljen.
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Uporabniki" value={users.length} />
        <MetricCard label="Organizacije" value={organizations.length} />
        <MetricCard label="Znamke" value={totalBrands} />
        <MetricCard label="Leadi" value={leadCount} />
      </div>

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
              <CardDescription>Paket {summary.plan}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <InlineMetric label="Org." value={summary.organizations} />
                <InlineMetric label="Upor." value={summary.users} />
                <InlineMetric label="Znamke" value={summary.brands} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Uporabniki, organizacije in account nivo</CardTitle>
          <CardDescription>
            Vsaka vrstica predstavlja članstvo uporabnika v organizaciji.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Uporabnik</TH>
                <TH>Registriran</TH>
                <TH>Organizacija</TH>
                <TH>Znamke</TH>
                <TH>Nivo</TH>
                <TH>Billing</TH>
                <TH>Spremeni account</TH>
              </TR>
            </THead>
            <TBody>
              {users.flatMap((user) => {
                if (user.memberships.length === 0) {
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
                      <TD>{user.createdAt.toLocaleString("sl-SI")}</TD>
                      <TD>brez organizacije</TD>
                      <TD>0</TD>
                      <TD>
                        <Badge variant="secondary">-</Badge>
                      </TD>
                      <TD>-</TD>
                      <TD>-</TD>
                    </TR>
                  );
                }

                return user.memberships.map((membership, index) => {
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
                            dodatna organizacija
                          </div>
                        )}
                      </TD>
                      <TD>{user.createdAt.toLocaleString("sl-SI")}</TD>
                      <TD>
                        <div className="font-medium">{organization.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {membership.role}
                        </div>
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
                            {plans.map((plan) => (
                              <option key={plan} value={plan}>
                                {plan}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" variant="outline">
                            Shrani
                          </Button>
                        </form>
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
                Zadnji leadi
              </CardTitle>
              <CardDescription>
                Zadnjih 20 leadov iz brezplačnega audita.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/leads">Vsi leadi</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Domena</TH>
                <TH>Znamka</TH>
                <TH>AI Visibility Score</TH>
                <TH>Lead score</TH>
                <TH>Ustvarjeno</TH>
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
                  <TD>{lead.createdAt.toLocaleString("sl-SI")}</TD>
                  <TD>
                    <Badge variant="secondary">{lead.status}</Badge>
                  </TD>
                </TR>
              ))}
              {leads.length === 0 && (
                <TR>
                  <TD colSpan={7} className="text-muted-foreground">
                    Ni zajetih leadov.
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
          {value.toLocaleString("sl-SI")}
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
        {value.toLocaleString("sl-SI")}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === "growth") return <Badge>growth</Badge>;
  if (plan === "starter") return <Badge variant="warning">starter</Badge>;
  return <Badge variant="secondary">free</Badge>;
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
  if (organization.plan !== "free" && !subscription?.stripeSubscriptionId) {
    return <Badge variant="success">ročno aktivno</Badge>;
  }
  if (subscription?.stripeSubscriptionId) {
    const status = subscription.status ?? "brez statusa";
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
  return <Badge variant="secondary">ni aktivno</Badge>;
}

function isPlan(value: string): value is Plan {
  return value === "free" || value === "starter" || value === "growth";
}
