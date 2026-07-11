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
    "Yes means the citation points to your brand domain. It is not just a mention, but a source the model refers to.",
  competitor:
    "Yes means the citation points to a domain recorded as a competitor.",
  supportsBrand:
    "Yes means the citation supports a recommendation or claim in favor of your brand.",
  supportsCompetitor:
    "Yes means the citation supports a recommendation or claim in favor of a competitor.",
} as const;

async function addCitationDomainAsCompetitor(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) throw new Error("Domain not found");

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
        <h1 className="text-3xl font-semibold">Citation table</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <BrandMenu brandId={brandId} active="citations" />
      <Card>
        <CardHeader>
          <CardTitle>Sources cited by AI models</CardTitle>
        </CardHeader>
        <CardContent>
          {citations.length === 0 && (
            <div className="mb-4 rounded-md border bg-secondary/30 p-4 text-sm text-muted-foreground">
              No citations yet. Run a new scan with a search-enabled model, for
              example ChatGPT + search.
            </div>
          )}
          <Table>
            <THead className="sticky top-0 z-10 bg-white shadow-sm">
              <TR>
                <TH>URL</TH>
                <TH>Domain</TH>
                <TH>Title</TH>
                <TH>Model</TH>
                <TH>Prompt</TH>
                <TH title={CITATION_TOOLTIPS.owned}>Owned domain</TH>
                <TH title={CITATION_TOOLTIPS.competitor}>Competitor</TH>
                <TH title={CITATION_TOOLTIPS.supportsBrand}>Supports brand</TH>
                <TH title={CITATION_TOOLTIPS.supportsCompetitor}>
                  Supports competitor
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
                          Add to my competitors
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
