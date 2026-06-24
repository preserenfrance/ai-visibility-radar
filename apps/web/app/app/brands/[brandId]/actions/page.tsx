import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { ExternalLink, Search } from "lucide-react";
import { BrandMenu } from "@/components/brand-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireBrandAccess } from "@/lib/auth";
import {
  promptContentReviewStorageAvailable,
  reviewPromptContentForBrand,
} from "@/lib/services";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RecommendationStatus = "open" | "in_progress" | "done" | "dismissed";

async function runPromptContentReview(formData: FormData) {
  "use server";
  const promptId = String(formData.get("promptId"));
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: { promptSet: true },
  });
  if (!prompt) throw new Error("Prompt ni najden");

  await requireBrandAccess(prompt.promptSet.brandId);
  if (!(await promptContentReviewStorageAvailable())) {
    redirect(
      `/app/brands/${prompt.promptSet.brandId}/actions?reviewStorage=missing`,
    );
  }
  await reviewPromptContentForBrand(promptId);
  redirect(`/app/brands/${prompt.promptSet.brandId}/actions`);
}

async function updateStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("recommendationId"));
  const status = String(formData.get("status")) as RecommendationStatus;
  const recommendation = await prisma.recommendation.findUnique({
    where: { id },
  });
  if (!recommendation) throw new Error("Priporočilo ni najdeno");

  await requireBrandAccess(recommendation.brandId);
  await prisma.recommendation.update({ where: { id }, data: { status } });
  redirect(`/app/brands/${recommendation.brandId}/actions`);
}

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams?: Promise<{ reviewStorage?: string }>;
}) {
  const { brandId } = await params;
  const query = await searchParams;
  const { brand } = await requireBrandAccess(brandId);
  const [promptSet, recommendations, reviewStorageAvailable] =
    await Promise.all([
      prisma.promptSet.findFirst({
        where: { brandId, status: "active" },
        orderBy: { createdAt: "desc" },
        include: {
          prompts: {
            orderBy: { priority: "asc" },
          },
        },
      }),
      prisma.recommendation.findMany({
        where: { brandId },
        orderBy: [
          { status: "asc" },
          { impactScore: "desc" },
          { createdAt: "desc" },
        ],
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
            Pregledi vsebine cakajo na posodobitev baze. Po migraciji bo rocni
            pregled promptov na voljo tukaj.
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
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
                          {review?.status === "failed"
                            ? "ni uspelo"
                            : "ni najdeno"}
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
                        <Button
                          size="sm"
                          type="submit"
                          disabled={!reviewStorageAvailable}
                        >
                          <Search className="h-4 w-4" />
                          Preveri
                        </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Priporočene naloge iz scanov</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Naslov</TH>
                <TH>Opis</TH>
                <TH>Učinek</TH>
                <TH>Zahtevnost</TH>
                <TH>Status</TH>
                <TH>Povezani prompti</TH>
                <TH>Navodila za prompt</TH>
                <TH>Povezani modeli</TH>
                <TH>Posodobi</TH>
              </TR>
            </THead>
            <TBody>
              {recommendations.map((item) => (
                <TR key={item.id}>
                  <TD className="font-medium">{item.title}</TD>
                  <TD className="max-w-md">{item.description}</TD>
                  <TD>{item.impactScore}</TD>
                  <TD>{item.effortScore}</TD>
                  <TD>
                    <Badge variant="secondary">{item.status}</Badge>
                  </TD>
                  <TD className="max-w-xs">
                    {jsonArray(item.affectedPromptsJson)
                      .slice(0, 3)
                      .join(" · ") || "-"}
                  </TD>
                  <TD className="max-w-md">
                    <div className="grid gap-2">
                      {promptInstructionsForRecommendation(item).map(
                        (instruction) => (
                          <div
                            key={instruction.prompt}
                            className="rounded-md border bg-secondary/30 p-2 text-xs"
                          >
                            <div className="font-medium">
                              {instruction.prompt}
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              {instruction.text}
                            </div>
                          </div>
                        ),
                      )}
                      {promptInstructionsForRecommendation(item).length === 0 &&
                        "-"}
                    </div>
                  </TD>
                  <TD>
                    {jsonArray(item.affectedEnginesJson).join(", ") || "-"}
                  </TD>
                  <TD>
                    <form action={updateStatus} className="flex gap-2">
                      <input
                        type="hidden"
                        name="recommendationId"
                        value={item.id}
                      />
                      <select
                        name="status"
                        defaultValue={item.status}
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="open">odprto</option>
                        <option value="in_progress">v delu</option>
                        <option value="done">zaključeno</option>
                        <option value="dismissed">zavrnjeno</option>
                      </select>
                      <Button size="sm" type="submit">
                        Shrani
                      </Button>
                    </form>
                  </TD>
                </TR>
              ))}
              {recommendations.length === 0 && (
                <TR>
                  <TD colSpan={9} className="text-muted-foreground">
                    Ni še priporočil iz scanov.
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

function promptInstructionsForRecommendation(item: {
  title: string;
  description: string;
  affectedPromptsJson: unknown;
}) {
  return jsonArray(item.affectedPromptsJson)
    .slice(0, 5)
    .map((prompt) => ({
      prompt,
      text: instructionForPrompt(item.title, item.description),
    }));
}

function instructionForPrompt(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("citat") || text.includes("vir")) {
    return "Dodaj ali izboljšaj stran, ki neposredno odgovori na ta prompt, z jasnimi podatki, primeri uporabe, cenami in dokazili, da jo lahko AI modeli citirajo.";
  }
  if (text.includes("konkurent") || text.includes("zmaga")) {
    return "Okrepi vsebino za ta nakupni primer: jasno povej za koga je produkt primeren, kje ga kupiti, prednosti izbire in zakaj je boljša izbira od pogosto omenjenih alternativ.";
  }
  if (text.includes("točnost") || text.includes("napa")) {
    return "Preveri, ali ima spletna stran za ta primer sveže, enoznačne informacije; popravi nejasne trditve in dodaj strukturirane podatke, ki zmanjšajo možnost napačnega AI odgovora.";
  }
  return "Za ta prompt pripravi namensko vsebino, ki v eni strani jasno odgovori na vprašanje kupca, navede konkretne produkte ali storitve, lokacijo nakupa in dokazila za priporočilo.";
}
