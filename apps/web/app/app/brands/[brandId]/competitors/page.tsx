import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";

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
        <h1 className="text-3xl font-semibold">Competitor leaderboard</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Competitors</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Competitor name</TH>
                <TH>Mention count</TH>
                <TH>Average rank</TH>
                <TH>Share of voice</TH>
                <TH>Sentiment</TH>
                <TH>Top prompts where competitor wins</TH>
                <TH>Citations that support competitor</TH>
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
                      <div className="font-medium">{competitor.name}</div>
                      <div className="text-xs text-muted-foreground">{competitor.domain ?? "no domain"}</div>
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
