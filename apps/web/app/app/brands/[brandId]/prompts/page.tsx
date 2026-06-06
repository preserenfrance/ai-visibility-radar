import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function updatePrompt(formData: FormData) {
  "use server";
  const promptId = String(formData.get("promptId"));
  const prompt = await prisma.prompt.findUnique({ where: { id: promptId }, include: { promptSet: true } });
  if (!prompt) throw new Error("Prompt not found");
  await requireBrandAccess(prompt.promptSet.brandId);
  await prisma.prompt.update({
    where: { id: promptId },
    data: {
      text: String(formData.get("text") ?? prompt.text),
      isActive: formData.get("isActive") === "on"
    }
  });
  redirect(`/app/brands/${prompt.promptSet.brandId}/prompts`);
}

export default async function PromptsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  await requireBrandAccess(brandId);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      promptSets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          prompts: {
            orderBy: { priority: "asc" },
            include: {
              promptRuns: {
                orderBy: { createdAt: "desc" },
                include: { engine: true, aiResponse: { include: { parsedResult: true, citations: true, mentions: true } } },
                take: 12
              }
            }
          }
        }
      }
    }
  });
  const promptSet = brand?.promptSets[0];

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Prompt results</h1>
        <p className="text-muted-foreground">{brand?.name} · {promptSet?.prompts.length ?? 0} promptov</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Prompt table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Category</TH>
                <TH>ChatGPT result</TH>
                <TH>Gemini result</TH>
                <TH>Claude result</TH>
                <TH>Brand rank</TH>
                <TH>Brand mentioned</TH>
                <TH>Top competitor</TH>
                <TH>Last run</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {promptSet?.prompts.map((prompt) => {
                const latestRuns = latestByEngine(prompt.promptRuns);
                const allParsed = prompt.promptRuns
                  .map((run) => run.aiResponse?.parsedResult?.parsedJson as any)
                  .filter(Boolean);
                const firstParsed = allParsed[0];
                return (
                  <TR key={prompt.id}>
                    <TD className="min-w-80">
                      <details>
                        <summary className="cursor-pointer font-medium">{prompt.text}</summary>
                        <div className="mt-3 space-y-4 rounded-md border bg-secondary/30 p-3">
                          <form action={updatePrompt} className="space-y-2">
                            <input type="hidden" name="promptId" value={prompt.id} />
                            <Textarea name="text" defaultValue={prompt.text} />
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="isActive" defaultChecked={prompt.isActive} />
                              Active
                            </label>
                            <Button size="sm" type="submit">Save prompt</Button>
                          </form>
                          {prompt.promptRuns.slice(0, 3).map((run) => {
                            const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
                            return (
                              <div key={run.id} className="rounded-md border bg-white p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{run.engine.engineName}</Badge>
                                  <span className="text-xs text-muted-foreground">confidence {parsed?.confidence ?? "-"}</span>
                                </div>
                                <div className="text-sm font-medium">Raw answer</div>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                                  {run.aiResponse?.rawText ?? run.errorMessage ?? "No response"}
                                </pre>
                                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                                  <div>Rank: {parsed?.brandRank ?? "-"}</div>
                                  <div>Sentiment: {parsed?.sentiment ?? "-"}</div>
                                  <div>Accuracy: {parsed?.accuracyScore ?? "-"}</div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Citations: {run.aiResponse?.citations.map((citation) => citation.domain).join(", ") || "-"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </TD>
                    <TD><Badge variant="secondary">{prompt.category}</Badge></TD>
                    <TD>{engineCell(latestRuns.ChatGPT)}</TD>
                    <TD>{engineCell(latestRuns.Gemini)}</TD>
                    <TD>{engineCell(latestRuns.Claude)}</TD>
                    <TD>{firstParsed?.brandRank ?? "-"}</TD>
                    <TD>{firstParsed?.brandMentioned ? "yes" : "no"}</TD>
                    <TD>{firstParsed?.competitorsMentioned?.[0]?.name ?? "-"}</TD>
                    <TD>{prompt.promptRuns[0]?.createdAt.toLocaleString("sl-SI") ?? "-"}</TD>
                    <TD><Badge variant={prompt.isActive ? "default" : "secondary"}>{prompt.isActive ? "active" : "inactive"}</Badge></TD>
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

function latestByEngine(promptRuns: Array<any>) {
  return promptRuns.reduce<Record<string, any>>((acc, run) => {
    const engineName = run.engine.engineName;
    if (!acc[engineName]) acc[engineName] = run;
    return acc;
  }, {});
}

function engineCell(run?: any) {
  if (!run) return "-";
  const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
  if (run.status === "failed") return "failed";
  if (!parsed) return run.status;
  return parsed.brandMentioned ? `rank ${parsed.brandRank ?? "-"}` : "not mentioned";
}
