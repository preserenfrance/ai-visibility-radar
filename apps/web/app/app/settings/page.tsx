import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/billing-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { effectivePlanForOrganization } from "@/lib/billing";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/settings");
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: {
      brands: {
        include: {
          promptSets: {
            where: { status: "active" },
            include: { prompts: true },
          },
        },
      },
      billingSubscription: true,
    },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Nastavitve</h1>
        <p className="text-muted-foreground">
          Organizacije, omejitve paketov in status plačil.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organizacije</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ime</TH>
                <TH>Plan</TH>
                <TH>Znamke</TH>
                <TH>Limit promptov</TH>
                <TH>Zagon promptov</TH>
                <TH>Plačila</TH>
                <TH>Upravljanje</TH>
              </TR>
            </THead>
            <TBody>
              {organizations.map((organization) => {
                const effectivePlan =
                  effectivePlanForOrganization(organization);
                const limits = PLAN_LIMITS[effectivePlan];
                return (
                  <TR key={organization.id}>
                    <TD className="font-medium">{organization.name}</TD>
                    <TD>
                      <Badge>{effectivePlan}</Badge>
                    </TD>
                    <TD>
                      {organization.brands.length}/{limits.brandCount}
                    </TD>
                    <TD>{limits.promptsPerBrand} na znamko</TD>
                    <TD>{cadenceLabel(limits.scanCadence)}</TD>
                    <TD>
                      {organization.billingSubscription?.status ?? "ni aktivno"}
                    </TD>
                    <TD>
                      <BillingActions
                        organizationId={organization.id}
                        hasStripeCustomer={Boolean(
                          organization.stripeCustomerId,
                        )}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function cadenceLabel(value: "none" | "manual" | "daily") {
  if (value === "daily") return "avtomatsko dnevno";
  if (value === "manual") return "ročno";
  return "brez zagona";
}
