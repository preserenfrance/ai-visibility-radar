import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { Plus, Save, Trash2 } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function addCompetitor(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Ime konkurenta mora imeti vsaj 2 znaka");

  await requireBrandAccess(brandId);
  await prisma.competitor.create({
    data: {
      brandId,
      name,
      domain: optionalDomain(formData.get("domain")),
      description: optionalText(formData.get("description"))
    }
  });
  redirect(`/app/brands/${brandId}/competitors`);
}

async function updateCompetitor(formData: FormData) {
  "use server";
  const competitorId = String(formData.get("competitorId"));
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Ime konkurenta mora imeti vsaj 2 znaka");

  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) throw new Error("Konkurent ni najden");
  await requireBrandAccess(competitor.brandId);

  await prisma.competitor.update({
    where: { id: competitorId },
    data: {
      name,
      domain: optionalDomain(formData.get("domain")),
      description: optionalText(formData.get("description"))
    }
  });
  redirect(`/app/brands/${competitor.brandId}/competitors`);
}

async function deleteCompetitor(formData: FormData) {
  "use server";
  const competitorId = String(formData.get("competitorId"));
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) throw new Error("Konkurent ni najden");
  await requireBrandAccess(competitor.brandId);

  await prisma.competitor.delete({ where: { id: competitorId } });
  redirect(`/app/brands/${competitor.brandId}/competitors`);
}

export default async function CompetitorsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { brand } = await requireBrandAccess(brandId);
  const competitors = await prisma.competitor.findMany({ where: { brandId }, orderBy: { name: "asc" } });
  const mentionGroups = await prisma.mention.groupBy({
    by: ["entityName"],
    where: {
      entityType: "competitor",
      aiResponse: { promptRun: { scanRun: { brandId } } }
    },
    _count: { entityName: true },
    _avg: { rankPosition: true },
    orderBy: { _count: { entityName: "desc" } }
  });
  const totalMentions = mentionGroups.reduce((sum, item) => sum + item._count.entityName, 0);
  const losingRuns = await prisma.promptRun.findMany({
    where: {
      scanRun: { brandId },
      aiResponse: { mentions: { some: { entityType: "competitor" } } }
    },
    include: {
      prompt: true,
      engine: true,
      aiResponse: { include: { mentions: true, citations: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Pregled konkurentov</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <BrandMenu brandId={brandId} active="competitors" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dodaj konkurenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addCompetitor} className="grid gap-3">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="competitorName" className="text-sm font-medium">Ime konkurenta</label>
                <Input id="competitorName" name="name" placeholder="Npr. Konkurent d.o.o." required />
              </div>
              <div className="grid gap-2">
                <label htmlFor="competitorDomain" className="text-sm font-medium">Domena konkurenta</label>
                <Input id="competitorDomain" name="domain" placeholder="konkurent.si" />
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="competitorDescription" className="text-sm font-medium">Opis konkurenta</label>
              <Textarea id="competitorDescription" name="description" placeholder="Kratek opis ponudbe ali posebnosti konkurenta." />
            </div>
            <Button type="submit" className="justify-self-start">
              <Plus className="h-4 w-4" />
              Dodaj konkurenta
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Konkurenti</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ime konkurenta</TH>
                <TH>Število omemb</TH>
                <TH>Povprečni rang</TH>
                <TH>Delež glasu</TH>
                <TH>Sentiment</TH>
                <TH>Prompti, kjer konkurent zmaga</TH>
                <TH>Citati, ki podpirajo konkurenta</TH>
                <TH>Upravljanje</TH>
              </TR>
            </THead>
            <TBody>
              {competitors.map((competitor) => {
                const group = mentionGroups.find((item) => item.entityName === competitor.name);
                const runs = losingRuns.filter((run) =>
                  run.aiResponse?.mentions.some((mention) => mention.entityName === competitor.name)
                );
                const citations = [
                  ...new Set(
                    runs.flatMap((run) =>
                      run.aiResponse?.citations
                        .filter((citation) => citation.isCompetitorDomain || citation.supportsCompetitor)
                        .map((citation) => citation.domain) ?? []
                    )
                  )
                ];
                return (
                  <TR key={competitor.id}>
                    <TD>
                      <details>
                        <summary className="cursor-pointer font-medium text-primary">{competitor.name}</summary>
                        <form action={updateCompetitor} className="mt-3 grid min-w-72 gap-3 rounded-md border bg-secondary/30 p-3">
                          <input type="hidden" name="competitorId" value={competitor.id} />
                          <div className="grid gap-2">
                            <label htmlFor={`name-${competitor.id}`} className="text-xs font-medium">Ime konkurenta</label>
                            <Input id={`name-${competitor.id}`} name="name" defaultValue={competitor.name} required />
                          </div>
                          <div className="grid gap-2">
                            <label htmlFor={`domain-${competitor.id}`} className="text-xs font-medium">Domena</label>
                            <Input id={`domain-${competitor.id}`} name="domain" defaultValue={competitor.domain ?? ""} />
                          </div>
                          <div className="grid gap-2">
                            <label htmlFor={`description-${competitor.id}`} className="text-xs font-medium">Opis</label>
                            <Textarea id={`description-${competitor.id}`} name="description" defaultValue={competitor.description ?? ""} />
                          </div>
                          <Button size="sm" type="submit" className="justify-self-start">
                            <Save className="h-4 w-4" />
                            Shrani
                          </Button>
                        </form>
                      </details>
                      <div className="text-xs text-muted-foreground">{competitor.domain ?? "brez domene"}</div>
                      {competitor.description && <div className="mt-1 max-w-xs text-xs text-muted-foreground">{competitor.description}</div>}
                    </TD>
                    <TD>{group?._count.entityName ?? 0}</TD>
                    <TD>{group?._avg.rankPosition?.toFixed(1) ?? "-"}</TD>
                    <TD>{totalMentions ? Math.round(((group?._count.entityName ?? 0) / totalMentions) * 100) : 0}%</TD>
                    <TD><Badge variant="secondary">{sentimentForRuns(runs)}</Badge></TD>
                    <TD className="max-w-sm">
                      {runs.slice(0, 3).map((run) => (
                        <div key={run.id} className="mb-1 text-xs">{run.prompt.text}</div>
                      ))}
                    </TD>
                    <TD>{citations.join(", ") || "-"}</TD>
                    <TD>
                      <form action={deleteCompetitor}>
                        <input type="hidden" name="competitorId" value={competitor.id} />
                        <Button size="sm" variant="destructive" type="submit">
                          <Trash2 className="h-4 w-4" />
                          Izbriši
                        </Button>
                      </form>
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

function sentimentForRuns(runs: Array<any>) {
  const sentiments = runs.flatMap((run) => run.aiResponse?.mentions.map((mention: any) => mention.sentiment) ?? []);
  if (sentiments.includes("negative")) return "mixed";
  if (sentiments.includes("positive")) return "positive";
  return sentiments[0] ?? "neutral";
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalDomain(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? normalizeDomain(text) : null;
}
