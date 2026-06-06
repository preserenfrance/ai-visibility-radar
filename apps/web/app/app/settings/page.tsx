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
  if (!user) redirect("/login?next=/app/settings");
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
        <h1 className="text-3xl font-semibold">Nastavitve</h1>
        <p className="text-muted-foreground">Organizacije, omejitve paketov in status plačil.</p>
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
                <TH>Pogostost scanov</TH>
                <TH>Plačila</TH>
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
                    <TD>{limits.promptsPerBrand} na znamko</TD>
                    <TD>{limits.scanCadence}</TD>
                    <TD>{organization.billingSubscription?.status ?? "ni aktivno"}</TD>
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
