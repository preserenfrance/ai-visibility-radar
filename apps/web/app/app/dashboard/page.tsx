import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegularScanControls } from "@/components/regular-scan-controls";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireCurrentUser } from "@/lib/auth";
import { canRunAutomaticScans } from "@/lib/billing";

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
          <h1 className="text-3xl font-semibold">My brands</h1>
          <p className="text-muted-foreground">
            A list of brands, latest results and scan statuses.
          </p>
        </div>
        <Button asChild>
          <a href="/ai-visibility-checker">New brand</a>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Brands</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Brand</TH>
                <TH>Organization</TH>
                <TH>Score</TH>
                <TH>Latest scan</TH>
                <TH>Status</TH>
                <TH>Recurring scan</TH>
                <TH>Billing</TH>
              </TR>
            </THead>
            <TBody>
              {brands.map((brand) => {
                const automaticScanAccess = canRunAutomaticScans(
                  brand.organization,
                );
                const recurringScanActive =
                  brand.recurringScanActive && automaticScanAccess;
                const recurringScanScheduled = automaticScanAccess;

                return (
                  <TR key={brand.id}>
                    <TD>
                      <a
                        className="font-medium text-primary"
                        href={`/app/brands/${brand.id}`}
                      >
                        {brand.name}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {brand.domain}
                      </div>
                    </TD>
                    <TD>{brand.organization.name}</TD>
                    <TD>{brand.scoreSnapshots[0]?.visibilityScore ?? "-"}</TD>
                    <TD>
                      {brand.scanRuns[0]?.createdAt.toLocaleString("en-US") ??
                        "-"}
                    </TD>
                    <TD>
                      <Badge variant="secondary">
                        {brand.scanRuns[0]?.status ?? "no scan yet"}
                      </Badge>
                    </TD>
                    <TD>
                      {recurringScanScheduled ? (
                        <div className="grid gap-1">
                          <Badge>active</Badge>
                          <span className="text-xs text-muted-foreground">
                            {cadenceLabel(
                              brand.recurringScanCadence ?? "weekly",
                            )}
                            {brand.recurringScanNextRunAt
                              ? ` · next ${brand.recurringScanNextRunAt.toLocaleDateString("en-US")}`
                              : recurringScanActive
                                ? ""
                                : " · next run will be scheduled soon"}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary">inactive</Badge>
                      )}
                    </TD>
                    <TD>
                      <RegularScanControls
                        brandId={brand.id}
                        organizationId={brand.organizationId}
                        organizationPlan={brand.organization.plan}
                        hasStripeCustomer={Boolean(
                          brand.organization.stripeCustomerId,
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

function cadenceLabel(value: "weekly" | "daily" | null) {
  if (value === "daily") return "daily";
  if (value === "weekly") return "weekly";
  return "scheduled";
}
