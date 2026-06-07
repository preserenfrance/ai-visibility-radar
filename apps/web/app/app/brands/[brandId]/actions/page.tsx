import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { BrandMenu } from "@/components/brand-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function updateStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("recommendationId"));
  const status = String(formData.get("status")) as "open" | "in_progress" | "done" | "dismissed";
  const recommendation = await prisma.recommendation.findUnique({ where: { id } });
  if (!recommendation) throw new Error("Priporočilo ni najdeno");
  await requireBrandAccess(recommendation.brandId);
  await prisma.recommendation.update({ where: { id }, data: { status } });
  redirect(`/app/brands/${recommendation.brandId}/actions`);
}

export default async function ActionsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { brand } = await requireBrandAccess(brandId);
  const recommendations = await prisma.recommendation.findMany({
    where: { brandId },
    orderBy: [{ status: "asc" }, { impactScore: "desc" }, { createdAt: "desc" }]
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Akcijski center</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <BrandMenu brandId={brandId} active="actions" />
      <Card>
        <CardHeader>
          <CardTitle>Priporočene naloge</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Naslov</TH>
                <TH>Opis</TH>
                <TH>Učinek</TH>
                <TH>Zahtevnost</TH>
                <TH>Status</TH>
                <TH>Povezani prompti</TH>
                <TH>Povezani modeli</TH>
                <TH>Posodobi</TH>
              </TR>
            </THead>
            <TBody>
              {recommendations.map((item) => (
                <TR key={item.id}>
                  <TD className="font-medium">{item.title}</TD>
                  <TD className="max-w-md">{item.description}</TD>
                  <TD>{item.impactScore}</TD>
                  <TD>{item.effortScore}</TD>
                  <TD><Badge variant="secondary">{item.status}</Badge></TD>
                  <TD className="max-w-xs">{jsonArray(item.affectedPromptsJson).slice(0, 3).join(" · ") || "-"}</TD>
                  <TD>{jsonArray(item.affectedEnginesJson).join(", ") || "-"}</TD>
                  <TD>
                    <form action={updateStatus} className="flex gap-2">
                      <input type="hidden" name="recommendationId" value={item.id} />
                      <select name="status" defaultValue={item.status} className="h-8 rounded-md border bg-background px-2 text-xs">
                        <option value="open">odprto</option>
                        <option value="in_progress">v delu</option>
                        <option value="done">zaključeno</option>
                        <option value="dismissed">zavrnjeno</option>
                      </select>
                      <Button size="sm" type="submit">Shrani</Button>
                    </form>
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

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
