import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/app/onboarding");
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: {
      brands: { include: { promptSets: { where: { status: "active" }, include: { prompts: true } } } },
      billingSubscription: true
    }
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Organizacije, planske omejitve in billing status.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Plan</TH>
                <TH>Brands</TH>
                <TH>Prompt limit</TH>
                <TH>Scan cadence</TH>
                <TH>Billing</TH>
              </TR>
            </THead>
            <TBody>
              {organizations.map((organization) => {
                const limits = PLAN_LIMITS[organization.plan];
                return (
                  <TR key={organization.id}>
                    <TD className="font-medium">{organization.name}</TD>
                    <TD><Badge>{organization.plan}</Badge></TD>
                    <TD>{organization.brands.length}/{limits.brandCount}</TD>
                    <TD>{limits.promptsPerBrand} per brand</TD>
                    <TD>{limits.scanCadence}</TD>
                    <TD>{organization.billingSubscription?.status ?? "not active"}</TD>
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
