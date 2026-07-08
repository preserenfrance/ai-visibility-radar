import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { ExternalLink } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { TrackedAnchor } from "@/components/analytics-events";
import { PromptContentReviewSubmit } from "@/components/prompt-content-review-submit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";
import { canRunManualScans } from "@/lib/billing";
import {
  promptContentReviewStorageAvailable,
  reviewPromptContentForBrand,
} from "@/lib/services";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function runPromptContentReview(formData: FormData) {
  "use server";
  const promptId = String(formData.get("promptId"));
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: { promptSet: true },
  });
  if (!prompt) throw new Error("Prompt ni najden");

  const { brand } = await requireBrandAccess(prompt.promptSet.brandId);
  if (!canRunManualScans(brand.organization)) {
    redirect(`/app/brands/${prompt.promptSet.brandId}/actions?manualScan=paid`);
  }
  if (!(await promptContentReviewStorageAvailable())) {
    redirect(
      `/app/brands/${prompt.promptSet.brandId}/actions?reviewStorage=missing`,
    );
  }
  await reviewPromptContentForBrand(promptId);
  redirect(`/app/brands/${prompt.promptSet.brandId}/actions`);
}

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ manualScan?: string; reviewStorage?: string }>;
}) {
  const { brandId } = await params;
  const query = await searchParams;
  const { brand } = await requireBrandAccess(brandId);
  const manualScanAccess = canRunManualScans(brand.organization);
  const [promptSet, reviewStorageAvailable] = await Promise.all([
    prisma.promptSet.findFirst({
      where: { brandId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        prompts: {
          orderBy: { priority: "asc" },
        },
      },
    }),
    promptContentReviewStorageAvailable(),
  ]);
  const latestReviews =
    reviewStorageAvailable && promptSet?.prompts.length
      ? await prisma.promptContentReview.findMany({
          where: {
            promptId: { in: promptSet.prompts.map((prompt) => prompt.id) },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const latestReviewByPromptId = new Map<
    string,
    (typeof latestReviews)[number]
  >();

  for (const review of latestReviews) {
    if (!latestReviewByPromptId.has(review.promptId)) {
      latestReviewByPromptId.set(review.promptId, review);
    }
  }

  const showReviewStorageWarning =
    !reviewStorageAvailable || query?.reviewStorage === "missing";
  const showManualScanWarning =
    !manualScanAccess || query?.manualScan === "paid";

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Ideje za izboljšanje</h1>
        <p className="text-muted-foreground">{brand.name}</p>
      </div>
      <BrandMenu brandId={brandId} active="actions" />

      {showReviewStorageWarning && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="pt-5 text-sm text-amber-900">
            Pregledi vsebine čakajo na posodobitev baze. Po migraciji bo ročni
            pregled promptov na voljo tukaj.
          </CardContent>
        </Card>
      )}

      {showManualScanWarning && (
        <Card className="mb-6 border-primary/30 bg-secondary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5 text-sm">
            <span className="text-muted-foreground">
              Ročni pregled promptov je vključen v paket Starter ali Growth.
            </span>
            <Button asChild size="sm">
              <TrackedAnchor
                href="/app/settings"
                eventName="upgrade_plan_click"
                eventProperties={{
                  location: "brand_actions_manual_scan_warning",
                  plan: "starter",
                }}
              >
                Nadgradi za ročni zagon
              </TrackedAnchor>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pregled vsebine po promptih</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Prompt</TH>
                <TH>Ocena</TH>
                <TH>Prvi rezultat</TH>
                <TH>Povzetek</TH>
                <TH>Nasveti</TH>
                <TH>Zadnji pregled</TH>
                <TH>Akcija</TH>
              </TR>
            </THead>
            <TBody>
              {promptSet?.prompts.map((prompt) => {
                const review = latestReviewByPromptId.get(prompt.id);
                const recommendations = jsonArray(review?.recommendationsJson);
                return (
                  <TR key={prompt.id}>
                    <TD className="min-w-80 font-medium">{prompt.text}</TD>
                    <TD>
                      {review ? (
                        <Badge variant={reviewBadgeVariant(review)}>
                          {review.status === "failed"
                            ? "napaka"
                            : `${review.score ?? 1}/10`}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TD>
                    <TD className="max-w-xs">
                      {review?.resultUrl ? (
                        <a
                          href={review.resultUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <span className="line-clamp-2">
                            {review.resultTitle ?? review.resultUrl}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          {review
                            ? review.status === "failed"
                              ? "ni uspelo"
                              : "ni najdeno"
                            : "Zaženi pregled"}
                        </span>
                      )}
                    </TD>
                    <TD className="max-w-md whitespace-pre-wrap">
                      {review?.status === "failed"
                        ? review.errorMessage
                        : (review?.summary ?? "-")}
                    </TD>
                    <TD className="max-w-md">
                      {recommendations.length ? (
                        <ul className="list-disc space-y-1 pl-4">
                          {recommendations.slice(0, 4).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TD>
                    <TD>{review ? formatDate(review.createdAt) : "-"}</TD>
                    <TD>
                      <form action={runPromptContentReview}>
                        <input
                          type="hidden"
                          name="promptId"
                          value={prompt.id}
                        />
                        <PromptContentReviewSubmit
                          disabled={
                            !reviewStorageAvailable || !manualScanAccess
                          }
                        />
                      </form>
                    </TD>
                  </TR>
                );
              })}
              {!promptSet?.prompts.length && (
                <TR>
                  <TD colSpan={7} className="text-muted-foreground">
                    Najprej dodaj prompt.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function reviewBadgeVariant(review: {
  status: string;
  score: number | null;
}): "default" | "secondary" | "warning" | "danger" | "success" {
  if (review.status === "failed") return "danger";
  if ((review.score ?? 1) >= 8) return "success";
  if ((review.score ?? 1) >= 5) return "warning";
  return "danger";
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
