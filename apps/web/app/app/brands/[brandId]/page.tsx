import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { BrandMenu } from "@/components/brand-menu";
import { MetricCard } from "@/components/metric-card";
import { ProviderScanForm } from "@/components/provider-scan-form";
import { RegularScanControls } from "@/components/regular-scan-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";
import { selectedEngineVariantsFromFormData } from "@/lib/ai-providers";
import { hasActivePaidPlan } from "@/lib/billing";
import { createScanForBrand } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function startProviderScan(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  const { brand } = await requireBrandAccess(brandId);
  const paidAccess = hasActivePaidPlan(brand.organization);
  const scan = await createScanForBrand(brandId, {
    engineVariants: paidAccess
      ? selectedEngineVariantsFromFormData(formData)
      : [{ provider: "openai", searchEnabled: false }],
    runNow: false,
  });
  redirect(`/app/brands/${brandId}/scans/${scan?.id}`);
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
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
  const paidAccess = hasActivePaidPlan(brand.organization);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
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
        </CardContent>
      </Card>

      <BrandMenu brandId={brand.id} active="overview" />

      <div className="mb-6">
        <ProviderScanForm
          brandId={brand.id}
          action={startProviderScan}
          paidAccess={paidAccess}
        />
      </div>

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

      <div className="grid gap-4 md:grid-cols-4">
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

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
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
        <Card>
          <CardHeader>
            <CardTitle>Trenutna nastavitev</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span>Konkurenti</span>
              <strong>{brand.competitors.length}</strong>
            </div>
            <div className="flex justify-between">
              <span>Prompti</span>
              <strong>{promptSet?.prompts.length ?? 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>Reden scan</span>
              <strong>
                {brand.recurringScanActive
                  ? cadenceLabel(brand.recurringScanCadence)
                  : "ni aktiven"}
              </strong>
            </div>
            <RegularScanControls
              brandId={brand.id}
              organizationId={brand.organizationId}
              organizationPlan={brand.organization.plan}
              billingStatus={brand.organization.billingSubscription?.status}
              recurringScanActive={brand.recurringScanActive}
              hasStripeCustomer={Boolean(brand.organization.stripeCustomerId)}
            />
          </CardContent>
        </Card>
      </div>
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
