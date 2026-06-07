import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { BrandMenu } from "@/components/brand-menu";
import { ProviderScanForm } from "@/components/provider-scan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";
import { selectedProvidersFromFormData } from "@/lib/ai-providers";
import { createScanForBrand, crawlBrand, generatePromptsForBrand } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function startProviderScan(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  await requireBrandAccess(brandId);
  const scan = await createScanForBrand(brandId, {
    providers: selectedProvidersFromFormData(formData),
    promptLimit: 5,
    runNow: true,
    searchEnabled: false
  });
  redirect(`/app/brands/${brandId}/scans/${scan?.id}`);
}

async function refreshCrawlAndPrompts(formData: FormData) {
  "use server";
  const brandId = String(formData.get("brandId"));
  await requireBrandAccess(brandId);
  await crawlBrand(brandId, 50).catch(() => null);
  await generatePromptsForBrand(brandId, 25);
  redirect(`/app/brands/${brandId}/prompts`);
}

export default async function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  await requireBrandAccess(brandId);
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      competitors: true,
      scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 2 },
      crawlSnapshots: { orderBy: { createdAt: "desc" }, take: 1, include: { pages: true } },
      promptSets: { where: { status: "active" }, orderBy: { createdAt: "desc" }, take: 1, include: { prompts: true } },
      scanRuns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { scoreSnapshot: true, promptRuns: { include: { engine: true, aiResponse: { include: { parsedResult: true } } } } }
      }
    }
  });
  if (!brand) return null;

  const latestScan = brand.scanRuns[0];
  const latestScore = brand.scoreSnapshots[0];
  const previousScore = brand.scoreSnapshots[1];
  const trend =
    latestScore && previousScore ? latestScore.visibilityScore - previousScore.visibilityScore : null;
  const promptSet = brand.promptSets[0];

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{brand.name}</h1>
          <p className="text-muted-foreground">{brand.domain}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{brand.country}</Badge>
            <Badge variant="secondary">{brand.language}</Badge>
            {brand.industry && <Badge>{brand.industry}</Badge>}
          </div>
        </div>
        <div className="grid gap-3 sm:min-w-[24rem]">
          <form action={refreshCrawlAndPrompts}>
            <input type="hidden" name="brandId" value={brand.id} />
            <Button type="submit" variant="outline">Osveži crawl in prompte</Button>
          </form>
          <ProviderScanForm brandId={brand.id} action={startProviderScan} />
        </div>
      </div>
      <BrandMenu brandId={brand.id} />
      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="AI Visibility Score" value={latestScore?.visibilityScore ?? 0} suffix="/100" />
        <Metric label="Trend" value={trend ?? 0} prefix={trend !== null && trend > 0 ? "+" : ""} />
        <Metric label="Delež omemb" value={latestScore?.mentionScore ?? 0} suffix="/100" />
        <Metric label="Delež citatov" value={latestScore?.citationScore ?? 0} suffix="/100" />
        <Metric label="Točnost" value={latestScore?.accuracyScore ?? 0} suffix="/100" />
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
                {Object.entries(engineBreakdown(latestScan?.promptRuns ?? [])).map(([engine, item]) => (
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
            <div className="flex justify-between"><span>Konkurenti</span><strong>{brand.competitors.length}</strong></div>
            <div className="flex justify-between"><span>Pregledane strani</span><strong>{brand.crawlSnapshots[0]?.pages.length ?? 0}</strong></div>
            <div className="flex justify-between"><span>Prompti</span><strong>{promptSet?.prompts.length ?? 0}</strong></div>
            <div className="flex justify-between"><span>Zadnji scan</span><strong>{latestScan?.status ?? "brez"}</strong></div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Zadnji scani</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Začetek</TH>
                <TH>Status</TH>
                <TH>Score</TH>
                <TH>Izvedbe</TH>
              </TR>
            </THead>
            <TBody>
              {brand.scanRuns.map((scan) => (
                <TR key={scan.id}>
                  <TD>
                    <Link className="text-primary" href={`/app/brands/${brand.id}/scans/${scan.id}`}>
                      {scan.createdAt.toLocaleString("sl-SI")}
                    </Link>
                  </TD>
                  <TD><Badge variant="secondary">{scan.status}</Badge></TD>
                  <TD>{scan.scoreSnapshot?.visibilityScore ?? "-"}</TD>
                  <TD>{scan.completedPromptRuns}/{scan.totalPromptRuns}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value, suffix = "", prefix = "" }: { label: string; value: number; suffix?: string; prefix?: string }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">{prefix}{value}{suffix}</div>
      </CardContent>
    </Card>
  );
}

function engineBreakdown(promptRuns: Array<any>) {
  return promptRuns.reduce<Record<string, { total: number; mentioned: number; failed: number }>>((acc, run) => {
    const engine = run.engine.engineName;
    const parsed = run.aiResponse?.parsedResult?.parsedJson as any;
    const bucket = (acc[engine] ??= { total: 0, mentioned: 0, failed: 0 });
    bucket.total += 1;
    if (parsed?.brandMentioned) bucket.mentioned += 1;
    if (run.status === "failed") bucket.failed += 1;
    return acc;
  }, {});
}
