import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@ai-radar/db";
import { Plus, Trash2 } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import {
  CompetitorMentionCount,
  ModelMentionBadges,
} from "@/components/model-mention-badges";
import { PromptActiveToggle } from "@/components/prompt-active-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireBrandAccess } from "@/lib/auth";
import { canRunManualScans, promptLimitForOrganization } from "@/lib/billing";
import { createScanForBrand } from "@/lib/services";

export const dynamic = "force-dynamic";

const DEFAULT_PROMPT_CATEGORY = "category";
const DEFAULT_FUNNEL_STAGE = "consideration";

async function addPrompt(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const text = String(formData.get("text") ?? "").trim();
  const promptTexts = promptLinesFromText(text);

  if (promptTexts.length === 0)
    throw new Error("Vnesi vsaj en prompt z vsaj 3 znaki");
  if (promptTexts.some((prompt) => prompt.length < 3))
    throw new Error("Vsak prompt mora imeti vsaj 3 znake");

  const { brand } = await requireBrandAccess(brandId);
  const promptLimit = promptLimitForOrganization(brand.organization);
  let promptSet = await prisma.promptSet.findFirst({
    where: { brandId, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  if (!promptSet) {
    promptSet = await prisma.promptSet.create({
      data: {
        brandId,
        name: `${brand.name} ročni prompti`,
        language: brand.language,
        country: brand.country,
        status: "active",
      },
    });
  }

  const activePromptCount = await prisma.prompt.count({
    where: {
      promptSetId: promptSet.id,
      isActive: true,
    },
  });
  const availablePromptSlots = promptLimit - activePromptCount;
  if (availablePromptSlots <= 0) {
    throw new Error(
      `Bad Request: ta paket omogoča največ ${promptLimit} aktivnih promptov na znamko`,
    );
  }
  if (promptTexts.length > availablePromptSlots) {
    throw new Error(
      `Bad Request: dodaš lahko še največ ${availablePromptSlots} aktivnih promptov`,
    );
  }

  const lastPrompt = await prisma.prompt.findFirst({
    where: { promptSetId: promptSet.id },
    orderBy: { priority: "desc" },
    select: { priority: true },
  });

  await prisma.prompt.createMany({
    data: promptTexts.map((promptText, index) => ({
      promptSetId: promptSet.id,
      text: promptText,
      category: DEFAULT_PROMPT_CATEGORY,
      intent: "custom prompt",
      persona: "buyer",
      funnelStage: DEFAULT_FUNNEL_STAGE,
      priority: (lastPrompt?.priority ?? 0) + index + 1,
      isActive: true,
    })),
  });

  redirect(`/app/brands/${brandId}/prompts?added=1`);
}

async function startChatGptPromptReview(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const { user } = await requireBrandAccess(brandId);
  const scan = await createScanForBrand(brandId, {
    engineVariants: [{ provider: "openai", searchEnabled: false }],
    runNow: false,
    initiatedByUserId: user.id,
  });
  redirect(`/app/brands/${brandId}/scans/${scan?.id}`);
}

async function updatePrompt(formData: FormData) {
  "use server";
  const promptId = String(formData.get("promptId"));
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: { promptSet: true },
  });
  if (!prompt) throw new Error("Prompt ni najden");
  await requireBrandAccess(prompt.promptSet.brandId);
  await prisma.prompt.update({
    where: { id: promptId },
    data: {
      text: String(formData.get("text") ?? prompt.text),
    },
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
      _count: { select: { promptRuns: true } },
    },
  });
  if (!prompt) throw new Error("Prompt ni najden");
  await requireBrandAccess(prompt.promptSet.brandId);

  if (prompt._count.promptRuns > 0) {
    await prisma.prompt.update({
      where: { id: promptId },
      data: { isActive: false },
    });
  } else {
    await prisma.prompt.delete({ where: { id: promptId } });
  }

  redirect(`/app/brands/${prompt.promptSet.brandId}/prompts`);
}

export default async function PromptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ added?: string }>;
}) {
  const { brandId } = await params;
  const addedPrompts = (await searchParams)?.added === "1";
  await requireBrandAccess(brandId);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      organization: { include: { billingSubscription: true } },
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
                include: {
                  engine: true,
                  aiResponse: {
                    include: {
                      parsedResult: true,
                      citations: true,
                      mentions: true,
                    },
                  },
                },
                take: 12,
              },
            },
          },
        },
      },
    },
  });
  const promptSet = brand?.promptSets[0];
  const promptLimit = brand
    ? promptLimitForOrganization(brand.organization)
    : 10;
  const manualScanAccess = brand
    ? canRunManualScans(brand.organization)
    : false;
  const activePromptCount =
    promptSet?.prompts.filter((prompt) => prompt.isActive).length ?? 0;
  const promptLimitReached = activePromptCount >= promptLimit;

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Rezultati promptov</h1>
        <p className="text-muted-foreground">
          {brand?.name} · {activePromptCount}/{promptLimit} aktivnih promptov
        </p>
      </div>
      <BrandMenu brandId={brandId} active="prompts" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dodaj nove prompte</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addPrompt} className="grid gap-3">
            <input type="hidden" name="brandId" value={brandId} />
            <p className="text-sm text-muted-foreground">
              Vsak prompt vpiši v svojo vrstico. Lahko prilepiš več promptov
              naenkrat in nato enkrat klikneš dodaj.
            </p>
            <Textarea
              name="text"
              placeholder={`Kje lahko kupim kakovostno vrtno pohištvo z dostavo v Sloveniji?
Katera spletna trgovina ima dobro ponudbo kosilnic za manjši vrt?
Kje naj kupim visoke grede za domači vrt?`}
              required
              disabled={promptLimitReached}
              className="min-h-32"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {promptLimitReached
                  ? `Dosežen je limit ${promptLimit} aktivnih promptov za trenutni paket.`
                  : `Dodaš lahko še ${promptLimit - activePromptCount} aktivnih promptov.`}
              </p>
              <Button type="submit" disabled={promptLimitReached}>
                <Plus className="h-4 w-4" />
                Dodaj prompte
              </Button>
            </div>
          </form>
          {addedPrompts && manualScanAccess && (
            <form
              action={startChatGptPromptReview}
              className="mt-4 rounded-md border bg-secondary/30 p-4"
            >
              <input type="hidden" name="brandId" value={brandId} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Novi prompti so dodani. Lahko takoj zaženeš pregled v ChatGPT
                  za aktivne prompte te znamke.
                </p>
                <Button type="submit">Zaženi pregled s temi prompti</Button>
              </div>
            </form>
          )}
          {addedPrompts && !manualScanAccess && (
            <div className="mt-4 rounded-md border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Novi prompti so dodani. Ročni zagon pregleda je vključen v
                  paket Starter ali Growth.
                </p>
                <Button asChild>
                  <Link href="/app/settings">Nadgradi za ročni zagon</Link>
                </Button>
              </div>
            </div>
          )}
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
                <TH>Modeli</TH>
                <TH>Konkurenti</TH>
                <TH>Najboljši rang</TH>
                <TH>Zadnja izvedba</TH>
                <TH>Aktiven</TH>
                <TH>Upravljanje</TH>
              </TR>
            </THead>
            <TBody>
              {promptSet?.prompts.map((prompt) => {
                const latestRuns = Object.values(
                  latestByEngine(prompt.promptRuns),
                );
                return (
                  <TR key={prompt.id}>
                    <TD className="min-w-80">
                      <details>
                        <summary className="cursor-pointer font-medium">
                          {prompt.text}
                        </summary>
                        <div className="mt-3 space-y-4 rounded-md border bg-secondary/30 p-3">
                          <form action={updatePrompt} className="space-y-2">
                            <input
                              type="hidden"
                              name="promptId"
                              value={prompt.id}
                            />
                            <Textarea name="text" defaultValue={prompt.text} />
                            <Button size="sm" type="submit">
                              Shrani prompt
                            </Button>
                          </form>
                          {prompt.promptRuns.slice(0, 3).map((run) => {
                            const parsed = run.aiResponse?.parsedResult
                              ?.parsedJson as any;
                            return (
                              <div
                                key={run.id}
                                className="rounded-md border bg-white p-3"
                              >
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">
                                    {run.engine.engineName}
                                  </Badge>
                                  <Badge
                                    variant={statusBadgeVariant(run.status)}
                                  >
                                    {statusLabel(run.status)}
                                  </Badge>
                                </div>
                                <div className="text-sm font-medium">
                                  Izvorni odgovor
                                </div>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                                  {run.aiResponse?.rawText ??
                                    run.errorMessage ??
                                    "Ni odgovora"}
                                </pre>
                                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                                  <div>Rang: {parsed?.brandRank ?? "-"}</div>
                                  <div>
                                    Znamka omenjena:{" "}
                                    {parsed?.brandMentioned ? "da" : "ne"}
                                  </div>
                                  <div>
                                    Točnost: {parsed?.accuracyScore ?? "-"}
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Citati:{" "}
                                  {run.aiResponse?.citations
                                    .map((citation) => citation.domain)
                                    .join(", ") || "-"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </TD>
                    <TD>
                      <ModelMentionBadges runs={modelSummaries(latestRuns)} />
                    </TD>
                    <TD>
                      <CompetitorMentionCount
                        names={competitorNamesForRuns(latestRuns)}
                      />
                    </TD>
                    <TD>{bestBrandRank(latestRuns) ?? "-"}</TD>
                    <TD>
                      {prompt.promptRuns[0]?.createdAt.toLocaleString(
                        "sl-SI",
                      ) ?? "-"}
                    </TD>
                    <TD>
                      <PromptActiveToggle
                        promptId={prompt.id}
                        isActive={prompt.isActive}
                      />
                    </TD>
                    <TD>
                      <form action={deletePrompt}>
                        <input
                          type="hidden"
                          name="promptId"
                          value={prompt.id}
                        />
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

function promptLinesFromText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function latestByEngine(promptRuns: Array<any>) {
  return promptRuns.reduce<Record<string, any>>((acc, run) => {
    const engineName = run.engine.engineName;
    if (!acc[engineName]) acc[engineName] = run;
    return acc;
  }, {});
}

function modelSummaries(runs: Array<any>) {
  return runs.map((run) => {
    const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
    return {
      id: run.id,
      engineName: run.engine.engineName,
      provider: run.engine.provider,
      searchEnabled: run.engine.searchEnabled,
      status: run.status,
      brandMentioned:
        typeof parsed?.brandMentioned === "boolean"
          ? parsed.brandMentioned
          : null,
      brandRank:
        typeof parsed?.brandRank === "number" ? parsed.brandRank : null,
    };
  });
}

function competitorNamesForRuns(runs: Array<any>) {
  return runs.flatMap((run) =>
    (run.aiResponse?.mentions ?? [])
      .filter((mention: any) => mention.entityType === "competitor")
      .map((mention: any) => mention.entityName),
  );
}

function bestBrandRank(runs: Array<any>) {
  const ranks = runs
    .map((run) => {
      const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
      return typeof parsed?.brandRank === "number" ? parsed.brandRank : null;
    })
    .filter((rank): rank is number => typeof rank === "number");
  return ranks.length ? Math.min(...ranks) : null;
}

type BadgeVariant = "default" | "secondary" | "warning" | "danger" | "success";

function statusLabel(status: string) {
  switch (status) {
    case "queued":
    case "running":
      return "v delu";
    case "completed":
      return "končano";
    case "failed":
      return "napaka";
    case "canceled":
      return "preklicano";
    default:
      return status;
  }
}

function statusBadgeVariant(status: string): BadgeVariant {
  if (status === "queued" || status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "secondary";
}
