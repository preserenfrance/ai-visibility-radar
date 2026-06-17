import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Plus, Trash2 } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { PromptActiveToggle } from "@/components/prompt-active-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireBrandAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_PROMPT_CATEGORY = "category";
const DEFAULT_FUNNEL_STAGE = "consideration";

async function addPrompt(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const text = String(formData.get("text") ?? "").trim();

  if (text.length < 3) throw new Error("Prompt mora imeti vsaj 3 znake");

  const { brand } = await requireBrandAccess(brandId);
  let promptSet = await prisma.promptSet.findFirst({
    where: { brandId, status: "active" },
    orderBy: { createdAt: "desc" }
  });

  if (!promptSet) {
    promptSet = await prisma.promptSet.create({
      data: {
        brandId,
        name: `${brand.name} ročni prompti`,
        language: brand.language,
        country: brand.country,
        status: "active"
      }
    });
  }

  const lastPrompt = await prisma.prompt.findFirst({
    where: { promptSetId: promptSet.id },
    orderBy: { priority: "desc" },
    select: { priority: true }
  });

  await prisma.prompt.create({
    data: {
      promptSetId: promptSet.id,
      text,
      category: DEFAULT_PROMPT_CATEGORY,
      intent: "custom prompt",
      persona: "buyer",
      funnelStage: DEFAULT_FUNNEL_STAGE,
      priority: (lastPrompt?.priority ?? 0) + 1,
      isActive: true
    }
  });

  redirect(`/app/brands/${brandId}/prompts`);
}

async function updatePrompt(formData: FormData) {
  "use server";
  const promptId = String(formData.get("promptId"));
  const prompt = await prisma.prompt.findUnique({ where: { id: promptId }, include: { promptSet: true } });
  if (!prompt) throw new Error("Prompt ni najden");
  await requireBrandAccess(prompt.promptSet.brandId);
  await prisma.prompt.update({
    where: { id: promptId },
    data: {
      text: String(formData.get("text") ?? prompt.text)
    }
  });
  redirect(`/app/brands/${prompt.promptSet.brandId}/prompts`);
}

async function deletePrompt(formData: FormData) {
  "use server";
  const promptId = String(formData.get("promptId"));
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      promptSet: true,
      _count: { select: { promptRuns: true } }
    }
  });
  if (!prompt) throw new Error("Prompt ni najden");
  await requireBrandAccess(prompt.promptSet.brandId);

  if (prompt._count.promptRuns > 0) {
    await prisma.prompt.update({
      where: { id: promptId },
      data: { isActive: false }
    });
  } else {
    await prisma.prompt.delete({ where: { id: promptId } });
  }

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
        <h1 className="text-3xl font-semibold">Rezultati promptov</h1>
        <p className="text-muted-foreground">{brand?.name} · {promptSet?.prompts.length ?? 0} promptov</p>
      </div>
      <BrandMenu brandId={brandId} active="prompts" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dodaj nov prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addPrompt} className="grid gap-3">
            <input type="hidden" name="brandId" value={brandId} />
            <Textarea
              name="text"
              placeholder="Npr. Kateri ponudniki so najboljša izbira za tehnični SEO v Sloveniji?"
              required
            />
            <div className="flex justify-end">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Dodaj prompt
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tabela promptov</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Rezultat ChatGPT</TH>
                <TH>Rezultat Gemini</TH>
                <TH>Rezultat Claude</TH>
                <TH>Rang znamke</TH>
                <TH>Znamka omenjena</TH>
                <TH>Glavni konkurent</TH>
                <TH>Zadnja izvedba</TH>
                <TH>Aktiven</TH>
                <TH>Upravljanje</TH>
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
                            <Button size="sm" type="submit">Shrani prompt</Button>
                          </form>
                          {prompt.promptRuns.slice(0, 3).map((run) => {
                            const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
                            return (
                              <div key={run.id} className="rounded-md border bg-white p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{run.engine.engineName}</Badge>
                                  <span className="text-xs text-muted-foreground">zaupanje {parsed?.confidence ?? "-"}</span>
                                </div>
                                <div className="text-sm font-medium">Izvorni odgovor</div>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                                  {run.aiResponse?.rawText ?? run.errorMessage ?? "Ni odgovora"}
                                </pre>
                                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                                  <div>Rang: {parsed?.brandRank ?? "-"}</div>
                                  <div>Sentiment: {parsed?.sentiment ?? "-"}</div>
                                  <div>Točnost: {parsed?.accuracyScore ?? "-"}</div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Citati: {run.aiResponse?.citations.map((citation) => citation.domain).join(", ") || "-"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </TD>
                    <TD>{engineCell(latestRuns.ChatGPT)}</TD>
                    <TD>{engineCell(latestRuns.Gemini)}</TD>
                    <TD>{engineCell(latestRuns.Claude)}</TD>
                    <TD>{firstParsed?.brandRank ?? "-"}</TD>
                    <TD>{firstParsed?.brandMentioned ? "da" : "ne"}</TD>
                    <TD>{firstParsed?.competitorsMentioned?.[0]?.name ?? "-"}</TD>
                    <TD>{prompt.promptRuns[0]?.createdAt.toLocaleString("sl-SI") ?? "-"}</TD>
                    <TD><PromptActiveToggle promptId={prompt.id} isActive={prompt.isActive} /></TD>
                    <TD>
                      <form action={deletePrompt}>
                        <input type="hidden" name="promptId" value={prompt.id} />
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
  if (run.status === "failed") return "napaka";
  if (!parsed) return run.status;
  return parsed.brandMentioned ? `rang ${parsed.brandRank ?? "-"}` : "ni omenjeno";
}
