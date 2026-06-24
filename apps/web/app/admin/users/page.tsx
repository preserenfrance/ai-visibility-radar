import { redirect } from "next/navigation";
import { prisma, type Plan } from "@ai-radar/db";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser, requireAdminUser } from "@/lib/auth";
import {
  activateRecurringScansForGrowthOrganization,
  deactivateRecurringScansForOrganization,
} from "@/lib/services";

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

  if (plan === "growth") {
    await activateRecurringScansForGrowthOrganization(organizationId);
  } else {
    await deactivateRecurringScansForOrganization(organizationId);
  }

  redirect("/admin/users?updated=1");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login?next=/admin/users");
  if (!isAdminUser(currentUser))
    return <main className="p-8">Nimate dostopa do admin strani.</main>;

  const params = await searchParams;
  const users = await prisma.user.findMany({
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
  });

  const organizationIds = new Set<string>();
  let totalBrands = 0;
  for (const user of users) {
    for (const membership of user.memberships) {
      if (organizationIds.has(membership.organizationId)) continue;
      organizationIds.add(membership.organizationId);
      totalBrands += membership.organization._count.brands;
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Admin uporabniki</h1>
          <p className="mt-2 text-muted-foreground">
            Registrirani uporabniki, njihove organizacije, znamke in trenutni
            nivo accounta.
          </p>
        </div>
        {params?.updated && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            Account nivo je posodobljen.
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Uporabniki" value={users.length} />
        <Metric label="Organizacije" value={organizationIds.size} />
        <Metric label="Znamke" value={totalBrands} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabela uporabnikov</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Uporabnik</TH>
                <TH>Registriran</TH>
                <TH>Račun / organizacija</TH>
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
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
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
