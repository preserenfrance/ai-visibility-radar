import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegularScanControls } from "@/components/regular-scan-controls";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppDashboardPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/dashboard");
  const brands = await prisma.brand.findMany({
    where: { organization: { memberships: { some: { userId: user.id } } } },
    include: {
      organization: { include: { billingSubscription: true } },
      scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      scanRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Moje znamke</h1>
          <p className="text-muted-foreground">
            Seznam znamk, zadnjih rezultatov in statusov scanov.
          </p>
        </div>
        <Button asChild>
          <Link href="/ai-visibility-checker">Nova znamka</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Znamke</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Znamka</TH>
                <TH>Organizacija</TH>
                <TH>Score</TH>
                <TH>Zadnji scan</TH>
                <TH>Status</TH>
                <TH>Reden scan</TH>
                <TH>Plačilo</TH>
              </TR>
            </THead>
            <TBody>
              {brands.map((brand) => (
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
                  <TD>{brand.organization.name}</TD>
                  <TD>{brand.scoreSnapshots[0]?.visibilityScore ?? "-"}</TD>
                  <TD>
                    {brand.scanRuns[0]?.createdAt.toLocaleString("sl-SI") ??
                      "-"}
                  </TD>
                  <TD>
                    <Badge variant="secondary">
                      {brand.scanRuns[0]?.status ?? "brez scana"}
                    </Badge>
                  </TD>
                  <TD>
                    {brand.recurringScanActive ? (
                      <div className="grid gap-1">
                        <Badge>aktiven</Badge>
                        <span className="text-xs text-muted-foreground">
                          {cadenceLabel(brand.recurringScanCadence)}
                          {brand.recurringScanNextRunAt
                            ? ` · naslednji ${brand.recurringScanNextRunAt.toLocaleDateString("sl-SI")}`
                            : ""}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary">ni aktiven</Badge>
                    )}
                  </TD>
                  <TD>
                    <RegularScanControls
                      brandId={brand.id}
                      organizationId={brand.organizationId}
                      organizationPlan={brand.organization.plan}
                      billingStatus={
                        brand.organization.billingSubscription?.status
                      }
                      recurringScanActive={brand.recurringScanActive}
                      hasStripeCustomer={Boolean(
                        brand.organization.stripeCustomerId,
                      )}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function cadenceLabel(value: "weekly" | "daily" | null) {
  if (value === "daily") return "dnevno";
  if (value === "weekly") return "tedensko";
  return "po urniku";
}
