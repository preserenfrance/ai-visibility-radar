import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CitationsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { brand } = await requireBrandAccess(brandId);
  const citations = await prisma.citation.findMany({
    where: {
      aiResponse: {
        promptRun: {
          scanRun: { brandId }
        }
      }
    },
    include: {
      aiResponse: {
        include: {
          promptRun: {
            include: {
              prompt: true,
              engine: true
            }
          }
        }
      }
    },
    orderBy: { domain: "asc" }
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Tabela citatov</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Viri, ki jih citirajo AI modeli</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>URL</TH>
                <TH>Domena</TH>
                <TH>Naslov</TH>
                <TH>Model</TH>
                <TH>Prompt</TH>
                <TH>Lastna domena</TH>
                <TH>Konkurent</TH>
                <TH>Podpira znamko</TH>
                <TH>Podpira konkurenta</TH>
              </TR>
            </THead>
            <TBody>
              {citations.map((citation) => (
                <TR key={citation.id}>
                  <TD className="max-w-xs truncate">
                    <a className="text-primary" href={citation.url} target="_blank" rel="noreferrer">
                      {citation.url}
                    </a>
                  </TD>
                  <TD>{citation.domain}</TD>
                  <TD>{citation.title ?? "-"}</TD>
                  <TD>{citation.aiResponse.promptRun.engine.engineName}</TD>
                  <TD className="max-w-sm">{citation.aiResponse.promptRun.prompt.text}</TD>
                  <TD><Flag value={citation.isOwnedDomain} /></TD>
                  <TD><Flag value={citation.isCompetitorDomain} /></TD>
                  <TD><Flag value={citation.supportsBrand} /></TD>
                  <TD><Flag value={citation.supportsCompetitor} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function Flag({ value }: { value: boolean }) {
  return <Badge variant={value ? "default" : "secondary"}>{value ? "da" : "ne"}</Badge>;
}
