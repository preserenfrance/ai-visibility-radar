import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
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
  if (!recommendation) throw new Error("Recommendation not found");
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
        <h1 className="text-3xl font-semibold">Action Center</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recommended actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Description</TH>
                <TH>Impact</TH>
                <TH>Effort</TH>
                <TH>Status</TH>
                <TH>Affected prompts</TH>
                <TH>Affected engines</TH>
                <TH>Update</TH>
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
                        <option value="open">open</option>
                        <option value="in_progress">in progress</option>
                        <option value="done">done</option>
                        <option value="dismissed">dismissed</option>
                      </select>
                      <Button size="sm" type="submit">Save</Button>
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
