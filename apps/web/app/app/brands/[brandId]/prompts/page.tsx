import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Plus, Trash2 } from "lucide-react";
import { TrackedAnchor } from "@/components/analytics-events";
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
    throw new Error("Enter at least one prompt with at least 3 characters");
  if (promptTexts.some((prompt) => prompt.length < 3))
    throw new Error("Each prompt must have at least 3 characters");

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
        name: `${brand.name} manual prompts`,
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
      `Bad Request: this plan allows up to ${promptLimit} active prompts per brand`,
    );
  }
  if (promptTexts.length > availablePromptSlots) {
    throw new Error(
      `Bad Request: you can add up to ${availablePromptSlots} active prompts`,
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
  if (!prompt) throw new Error("Prompt not found");
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
  if (!prompt) throw new Error("Prompt not found");
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
        <h1 className="text-3xl font-semibold">Prompt results</h1>
        <p className="text-muted-foreground">
          {brand?.name} · {activePromptCount}/{promptLimit} active prompts
        </p>
      </div>
      <BrandMenu brandId={brandId} active="prompts" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add new prompts</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addPrompt} className="grid gap-3">
            <input type="hidden" name="brandId" value={brandId} />
            <p className="text-sm text-muted-foreground">
              Enter each prompt on its own line. You can paste multiple prompts
              at once and then click add once.
            </p>
            <Textarea
              name="text"
              placeholder={`Where can I buy quality garden furniture with delivery?
Which online store has a good selection of lawn mowers for a small garden?
Where should I buy raised garden beds for home use?`}
              required
              disabled={promptLimitReached}
              className="min-h-32"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {promptLimitReached
                  ? `Limit reached: ${promptLimit} active prompts for the current plan.`
                  : `You can add ${promptLimit - activePromptCount} more active prompts.`}
              </p>
              <Button type="submit" disabled={promptLimitReached}>
                <Plus className="h-4 w-4" />
                Add prompts
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
                  New prompts were added. You can immediately run a ChatGPT
                  review for the active prompts of this brand.
                </p>
                <Button type="submit">Run a scan with these prompts</Button>
              </div>
            </form>
          )}
          {addedPrompts && !manualScanAccess && (
            <div className="mt-4 rounded-md border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  New prompts were added. Manual scan runs are included in
                  the Starter or Growth plan.
                </p>
                <Button asChild>
                  <TrackedAnchor
                    href="/app/settings"
                    eventName="upgrade_plan_click"
                    eventProperties={{
                      location: "brand_prompts_manual_scan_warning",
                      plan: "starter",
                    }}
                  >
                    Upgrade for manual runs
                  </TrackedAnchor>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Prompt table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Modeli</TH>
                <TH>Competitors</TH>
                <TH>Best rank</TH>
                <TH>Last run</TH>
                <TH>Active</TH>
                <TH>Manage</TH>
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
                              Save prompt
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
                                  Raw answer
                                </div>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                                  {run.aiResponse?.rawText ??
                                    run.errorMessage ??
                                    "No answer"}
                                </pre>
                                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                                  <div>Rank: {parsed?.brandRank ?? "-"}</div>
                                  <div>
                                    Brand mentioned:{" "}
                                    {parsed?.brandMentioned ? "yes" : "no"}
                                  </div>
                                  <div>
                                    Accuracy: {parsed?.accuracyScore ?? "-"}
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Citations:{" "}
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
                        "en-US",
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
                          Delete
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
      return "in progress";
    case "completed":
      return "completed";
    case "failed":
      return "error";
    case "canceled":
      return "canceled";
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
