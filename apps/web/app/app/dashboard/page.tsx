import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppDashboardPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/app/onboarding");
  const brands = await prisma.brand.findMany({
    where: { organization: { memberships: { some: { userId: user.id } } } },
    include: {
      organization: true,
      scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      scanRuns: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Pregled brandov, zadnjih score snapshotov in scan statusov.</p>
        </div>
        <Button asChild>
          <Link href="/app/onboarding">Dodaj brand</Link>
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
                <TH>Last scan</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {brands.map((brand) => (
                <TR key={brand.id}>
                  <TD>
                    <Link className="font-medium text-primary" href={`/app/brands/${brand.id}`}>
                      {brand.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{brand.domain}</div>
                  </TD>
                  <TD>{brand.organization.name}</TD>
                  <TD>{brand.scoreSnapshots[0]?.visibilityScore ?? "-"}</TD>
                  <TD>{brand.scanRuns[0]?.createdAt.toLocaleString("sl-SI") ?? "-"}</TD>
                  <TD>
                    <Badge variant="secondary">{brand.scanRuns[0]?.status ?? "no scan"}</Badge>
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
