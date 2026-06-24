import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { BrandMenu } from "@/components/brand-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CITATION_TOOLTIPS = {
  owned:
    "Da pomeni, da citat vodi na domeno tvoje znamke. Ne pomeni samo omembe, ampak vir, na katerega se model sklicuje.",
  competitor:
    "Da pomeni, da citat vodi na domeno, ki jo imamo zabeleženo kot konkurenta.",
  supportsBrand:
    "Da pomeni, da vsebina citata podpira priporočilo ali trditev v korist tvoje znamke.",
  supportsCompetitor:
    "Da pomeni, da vsebina citata podpira priporočilo ali trditev v korist konkurenta.",
} as const;

async function addCitationDomainAsCompetitor(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) throw new Error("Domena ni najdena");

  await requireBrandAccess(brandId);

  await prisma.competitor.upsert({
    where: {
      brandId_name: {
        brandId,
        name: domain,
      },
    },
    update: {
      domain,
    },
    create: {
      brandId,
      name: domain,
      domain,
    },
  });

  redirect(`/app/brands/${brandId}/citations`);
}

export default async function CitationsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const { brand } = await requireBrandAccess(brandId);
  const citations = await prisma.citation.findMany({
    where: {
      aiResponse: {
        promptRun: {
          scanRun: { brandId },
        },
      },
    },
    include: {
      aiResponse: {
        include: {
          promptRun: {
            include: {
              prompt: true,
              engine: true,
            },
          },
        },
      },
    },
    orderBy: { domain: "asc" },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Tabela citatov</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <BrandMenu brandId={brandId} active="citations" />
      <Card>
        <CardHeader>
          <CardTitle>Viri, ki jih citirajo AI modeli</CardTitle>
        </CardHeader>
        <CardContent>
          {citations.length === 0 && (
            <div className="mb-4 rounded-md border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Citatov še ni. Zaženi nov scan z izbiro modela s searchom, na
              primer ChatGPT + search.
            </div>
          )}
          <Table>
            <THead className="sticky top-0 z-10 bg-white shadow-sm">
              <TR>
                <TH>URL</TH>
                <TH>Domena</TH>
                <TH>Naslov</TH>
                <TH>Model</TH>
                <TH>Prompt</TH>
                <TH title={CITATION_TOOLTIPS.owned}>Lastna domena</TH>
                <TH title={CITATION_TOOLTIPS.competitor}>Konkurent</TH>
                <TH title={CITATION_TOOLTIPS.supportsBrand}>Podpira znamko</TH>
                <TH title={CITATION_TOOLTIPS.supportsCompetitor}>
                  Podpira konkurenta
                </TH>
              </TR>
            </THead>
            <TBody>
              {citations.map((citation) => (
                <TR key={citation.id}>
                  <TD className="max-w-xs truncate">
                    <a
                      className="text-primary"
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {citation.url}
                    </a>
                  </TD>
                  <TD>
                    <div className="flex min-w-64 flex-wrap items-center gap-2">
                      <span>{citation.domain}</span>
                      <form action={addCitationDomainAsCompetitor}>
                        <input type="hidden" name="brandId" value={brandId} />
                        <input
                          type="hidden"
                          name="domain"
                          value={citation.domain}
                        />
                        <Button size="sm" variant="outline" type="submit">
                          Dodaj med moje konkurente
                        </Button>
                      </form>
                    </div>
                  </TD>
                  <TD>{citation.title ?? "-"}</TD>
                  <TD>
                    <span>
                      {citation.aiResponse.promptRun.engine.engineName}
                    </span>
                    {citation.aiResponse.promptRun.engine.searchEnabled && (
                      <Badge className="ml-2" variant="secondary">
                        search
                      </Badge>
                    )}
                  </TD>
                  <TD className="max-w-sm">
                    {citation.aiResponse.promptRun.prompt.text}
                  </TD>
                  <TD>
                    <Flag
                      value={citation.isOwnedDomain}
                      title={CITATION_TOOLTIPS.owned}
                    />
                  </TD>
                  <TD>
                    <Flag
                      value={citation.isCompetitorDomain}
                      title={CITATION_TOOLTIPS.competitor}
                    />
                  </TD>
                  <TD>
                    <Flag
                      value={citation.supportsBrand}
                      title={CITATION_TOOLTIPS.supportsBrand}
                    />
                  </TD>
                  <TD>
                    <Flag
                      value={citation.supportsCompetitor}
                      title={CITATION_TOOLTIPS.supportsCompetitor}
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

function Flag({ value, title }: { value: boolean; title: string }) {
  return (
    <Badge title={title} variant={value ? "default" : "secondary"}>
      {value ? "da" : "ne"}
    </Badge>
  );
}
