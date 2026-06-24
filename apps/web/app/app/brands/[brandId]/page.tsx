import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { Sparkles } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { MetricCard } from "@/components/metric-card";
import { ProviderScanForm } from "@/components/provider-scan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";
import { selectedEngineVariantsFromFormData } from "@/lib/ai-providers";
import { canRunAutomaticScans, canRunManualScans } from "@/lib/billing";
import {
  createScanForBrand,
  generateBrandChatGptSummary,
} from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function startProviderScan(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const { brand } = await requireBrandAccess(brandId);
  const manualScanAccess = canRunManualScans(brand.organization);
  const scan = await createScanForBrand(brandId, {
    engineVariants: manualScanAccess
      ? selectedEngineVariantsFromFormData(formData)
      : [{ provider: "openai", searchEnabled: false }],
    runNow: false,
  });
  redirect(`/app/brands/${brandId}/scans/${scan?.id}`);
}

async function refreshBrandChatGptSummary(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const { brand } = await requireBrandAccess(brandId);

  try {
    const summary = await generateBrandChatGptSummary({
      name: brand.name,
      domain: brand.domain,
      description: brand.description,
      industry: brand.industry,
      country: brand.country,
      language: brand.language,
    });
    await prisma.brand.update({
      where: { id: brandId },
      data: {
        chatGptBrandSummary: summary,
        chatGptBrandSummaryUpdatedAt: summary ? new Date() : undefined,
      },
    });
  } catch (error) {
    console.error("ChatGPT brand summary refresh failed", error);
    redirect(`/app/brands/${brandId}?brandSummary=error`);
  }

  redirect(`/app/brands/${brandId}`);
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ brandSummary?: string }>;
}) {
  const { brandId } = await params;
  const query = await searchParams;
  await requireBrandAccess(brandId);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      organization: { include: { billingSubscription: true } },
      competitors: true,
      scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 2 },
      promptSets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { prompts: true },
      },
      scanRuns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          scoreSnapshot: true,
          promptRuns: {
            include: {
              engine: true,
              aiResponse: { include: { parsedResult: true } },
            },
          },
        },
      },
    },
  });
  if (!brand) return null;

  const latestScan = brand.scanRuns[0];
  const latestScore = brand.scoreSnapshots[0];
  const promptSet = brand.promptSets[0];
  const manualScanAccess = canRunManualScans(brand.organization);
  const automaticScanAccess = canRunAutomaticScans(brand.organization);
  const recurringScanActive = brand.recurringScanActive && automaticScanAccess;
  const recurringScanScheduled = automaticScanAccess;
  const brandSummaryError = query?.brandSummary === "error";

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <BrandMenu brandId={brand.id} active="overview" />

      <Card className="mb-6">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-start">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Znamka
            </div>
            <h1 className="mt-1 text-3xl font-semibold">{brand.name}</h1>
            <p className="text-muted-foreground">{brand.domain}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Badge variant="secondary">{brand.country}</Badge>
            <Badge variant="secondary">{brand.language}</Badge>
            {brand.industry && <Badge>{brand.industry}</Badge>}
          </div>
          <div className="grid gap-3 rounded-md border bg-white p-4 text-sm md:col-span-2 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Konkurenti
              </div>
              <div className="mt-1 text-lg font-semibold">
                {brand.competitors.length}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Prompti
              </div>
              <div className="mt-1 text-lg font-semibold">
                {promptSet?.prompts.length ?? 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Reden scan
              </div>
              <div className="mt-1 text-lg font-semibold">
                {recurringScanScheduled
                  ? cadenceLabel(brand.recurringScanCadence ?? "weekly")
                  : "ni aktiven"}
              </div>
              {recurringScanScheduled && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {brand.recurringScanNextRunAt
                    ? `Naslednji: ${brand.recurringScanNextRunAt.toLocaleString("sl-SI")}`
                    : recurringScanActive
                      ? "Naslednji termin se nastavlja."
                      : "Naslednji termin se nastavi ob naslednjem cron zagonu."}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-md border bg-secondary/30 p-4 md:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                ChatGPT pogled na znamko
              </div>
              <form action={refreshBrandChatGptSummary}>
                <input type="hidden" name="brandId" value={brand.id} />
                <Button type="submit" size="sm" variant="outline">
                  {brand.chatGptBrandSummary ? "Osveži" : "Pripravi"}
                </Button>
              </form>
            </div>
            {brand.chatGptBrandSummary ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {brand.chatGptBrandSummary}
              </p>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                ChatGPT pogled se pripravi ob ustvarjanju nove kampanje ali s
                klikom na gumb Pripravi.
              </p>
            )}
            {brandSummaryError && (
              <p className="mt-2 text-xs text-destructive">
                ChatGPT pogleda trenutno ni bilo mogoče pripraviti. Preveri
                OpenAI nastavitev ali poskusi ponovno.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          metric="visibility"
          value={latestScore?.visibilityScore ?? 0}
        />
        <MetricCard metric="mentions" value={latestScore?.mentionScore ?? 0} />
        <MetricCard
          metric="shareOfVoice"
          value={latestScore?.shareOfVoiceScore ?? 0}
        />
        <MetricCard metric="accuracy" value={latestScore?.accuracyScore ?? 0} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pregled po modelih</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Model</TH>
                <TH>Izvedbe</TH>
                <TH>Omembe</TH>
                <TH>Napake</TH>
              </TR>
            </THead>
            <TBody>
              {Object.entries(
                engineBreakdown(latestScan?.promptRuns ?? []),
              ).map(([engine, item]) => (
                <TR key={engine}>
                  <TD>{engine}</TD>
                  <TD>{item.total}</TD>
                  <TD>{item.mentioned}</TD>
                  <TD>{item.failed}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Zadnji scani</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Začetek</TH>
                <TH>Status</TH>
                <TH>Vidnost</TH>
                <TH>Izvedbe</TH>
              </TR>
            </THead>
            <TBody>
              {brand.scanRuns.map((scan) => (
                <TR key={scan.id}>
                  <TD>
                    <Link
                      className="text-primary"
                      href={`/app/brands/${brand.id}/scans/${scan.id}`}
                    >
                      {scan.createdAt.toLocaleString("sl-SI")}
                    </Link>
                  </TD>
                  <TD>
                    <Badge variant={statusBadgeVariant(scan.status)}>
                      {statusLabel(scan.status)}
                    </Badge>
                  </TD>
                  <TD>{scan.scoreSnapshot?.visibilityScore ?? "-"}</TD>
                  <TD>
                    {scan.completedPromptRuns}/{scan.totalPromptRuns}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <ProviderScanForm
        brandId={brand.id}
        action={startProviderScan}
        manualScanAccess={manualScanAccess}
        compact
      />
    </section>
  );
}

function engineBreakdown(promptRuns: Array<any>) {
  return promptRuns.reduce<
    Record<string, { total: number; mentioned: number; failed: number }>
  >((acc, run) => {
    const engine = run.engine.engineName;
    const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
    const bucket = (acc[engine] ??= { total: 0, mentioned: 0, failed: 0 });
    bucket.total += 1;
    if (parsed?.brandMentioned) bucket.mentioned += 1;
    if (run.status === "failed") bucket.failed += 1;
    return acc;
  }, {});
}

function cadenceLabel(value: "weekly" | "daily" | null) {
  if (value === "daily") return "dnevno";
  if (value === "weekly") return "tedensko";
  return "po urniku";
}

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

function statusBadgeVariant(status: string) {
  if (status === "queued" || status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "secondary";
}
