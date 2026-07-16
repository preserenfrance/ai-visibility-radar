import { NextResponse } from "next/server";
import { prisma } from "@ai-radar/db";
import { verifyReportContextToken } from "@/lib/report-context-token";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = verifyReportContextToken(token);
  if (!payload) {
    return markdownResponse("Report context link is invalid or expired.", 410);
  }

  if (payload.type === "scan") {
    const scan = await prisma.scanRun.findFirst({
      where: { id: payload.scanId, brandId: payload.brandId },
      include: {
        brand: { include: { competitors: true } },
        scoreSnapshot: true,
        recommendations: {
          orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
          take: 8,
        },
        promptRuns: {
          orderBy: { createdAt: "asc" },
          include: promptRunIncludes(),
        },
      },
    });
    if (!scan) return markdownResponse("Report context was not found.", 404);
    return markdownResponse(scanContextMarkdown(scan));
  }

  const brand = await prisma.brand.findUnique({
    where: { id: payload.brandId },
    include: {
      competitors: { orderBy: { name: "asc" } },
      scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 3 },
      recommendations: {
        where: { status: "open" },
        orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
        take: 8,
      },
      promptSets: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          prompts: {
            where: { isActive: true },
            orderBy: { priority: "asc" },
          },
        },
      },
      scanRuns: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          scoreSnapshot: true,
          recommendations: {
            orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
            take: 5,
          },
          promptRuns: {
            orderBy: { createdAt: "asc" },
            include: promptRunIncludes(),
          },
        },
      },
    },
  });
  if (!brand) return markdownResponse("Report context was not found.", 404);
  return markdownResponse(brandContextMarkdown(brand));
}

function promptRunIncludes() {
  return {
    prompt: true,
    engine: true,
    aiResponse: {
      include: {
        parsedResult: true,
        citations: true,
        mentions: true,
        searchCalls: true,
      },
    },
  } as const;
}

function markdownResponse(markdown: string, status = 200) {
  return new NextResponse(markdown, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function brandContextMarkdown(brand: any) {
  const activePromptSet = brand.promptSets[0];
  const latestScore = brand.scoreSnapshots[0];
  const latestScan = brand.scanRuns[0];

  return [
    `# AI visibility context: ${brand.name}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Domain: ${brand.domain}`,
    `Market: ${brand.country}`,
    `Language: ${brand.language}`,
    brand.industry ? `Industry: ${brand.industry}` : "",
    "",
    "## Current score",
    scoreMarkdown(latestScore),
    "",
    "## Competitors",
    listOrEmpty(
      brand.competitors.map(
        (competitor: any) =>
          `${competitor.name}${competitor.domain ? ` (${competitor.domain})` : ""}`,
      ),
    ),
    "",
    "## Active prompts",
    listOrEmpty(
      (activePromptSet?.prompts ?? [])
        .slice(0, 30)
        .map((prompt: any) => prompt.text),
    ),
    "",
    "## Open recommendations",
    recommendationsMarkdown(brand.recommendations),
    "",
    "## Latest scans",
    brand.scanRuns.length
      ? brand.scanRuns.map(scanSummaryMarkdown).join("\n\n")
      : "No scans are available.",
    "",
    latestScan ? scanPromptFindingsMarkdown(latestScan.promptRuns) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function scanContextMarkdown(scan: any) {
  return [
    `# AI visibility scan context: ${scan.brand.name}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Scan ID: ${scan.id}`,
    `Scan status: ${scan.status}`,
    `Scan created: ${scan.createdAt.toISOString()}`,
    `Domain: ${scan.brand.domain}`,
    `Market: ${scan.brand.country}`,
    `Language: ${scan.brand.language}`,
    scan.brand.industry ? `Industry: ${scan.brand.industry}` : "",
    "",
    "## Score",
    scoreMarkdown(scan.scoreSnapshot),
    "",
    "## Competitors",
    listOrEmpty(
      scan.brand.competitors.map(
        (competitor: any) =>
          `${competitor.name}${competitor.domain ? ` (${competitor.domain})` : ""}`,
      ),
    ),
    "",
    "## Recommendations",
    recommendationsMarkdown(scan.recommendations),
    "",
    scanPromptFindingsMarkdown(scan.promptRuns),
  ]
    .filter(Boolean)
    .join("\n");
}

function scanSummaryMarkdown(scan: any) {
  return [
    `### Scan ${scan.createdAt.toISOString()}`,
    `Status: ${scan.status}`,
    `Prompt runs: ${scan.completedPromptRuns}/${scan.totalPromptRuns}`,
    scoreMarkdown(scan.scoreSnapshot),
    scan.recommendations?.length
      ? recommendationsMarkdown(scan.recommendations)
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function scanPromptFindingsMarkdown(promptRuns: any[]) {
  if (!promptRuns.length)
    return "## Prompt findings\nNo prompt runs are available.";
  const grouped = groupPromptRuns(promptRuns).slice(0, 20);
  return [
    "## Prompt findings",
    grouped
      .map((group) => {
        return [
          `### ${group.promptText}`,
          group.runs.map(promptRunMarkdown).join("\n\n"),
        ].join("\n");
      })
      .join("\n\n"),
  ].join("\n");
}

function promptRunMarkdown(run: any) {
  const parsed = run.aiResponse?.parsedResult;
  const citations = run.aiResponse?.citations ?? [];
  const searchCalls = run.aiResponse?.searchCalls ?? [];
  const competitors = (run.aiResponse?.mentions ?? [])
    .filter((mention: any) => mention.entityType === "competitor")
    .map((mention: any) =>
      mention.rankPosition
        ? `${mention.entityName} (#${mention.rankPosition})`
        : mention.entityName,
    );

  return [
    `- Model: ${run.engine.engineName}`,
    `- Status: ${run.status}`,
    parsed
      ? `- Brand mentioned: ${parsed.brandMentioned ? "yes" : "no"}`
      : "- Brand mentioned: unknown",
    parsed?.brandRank ? `- Brand rank: #${parsed.brandRank}` : "",
    parsed ? `- Mention count: ${parsed.mentionCount}` : "",
    parsed ? `- Sentiment: ${parsed.sentiment}` : "",
    parsed ? `- Accuracy score: ${parsed.accuracyScore}/100` : "",
    competitors.length ? `- Competitors: ${competitors.join(", ")}` : "",
    citations.length
      ? `- Citations: ${citations
          .slice(0, 8)
          .map((citation: any) => citation.domain)
          .join(", ")}`
      : "- Citations: none",
    searchCalls.length
      ? `- Provider search queries: ${searchCalls
          .slice(0, 5)
          .map((call: any) => call.query)
          .join(" | ")}`
      : "",
    run.aiResponse?.rawText
      ? `- Answer excerpt: ${truncate(cleanInline(run.aiResponse.rawText), 900)}`
      : run.errorMessage
        ? `- Error: ${cleanInline(run.errorMessage)}`
        : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function scoreMarkdown(score: any) {
  if (!score) return "No score snapshot is available.";
  return [
    `- Visibility: ${score.visibilityScore}/100`,
    `- Mentions: ${score.mentionScore}/100`,
    `- Rank: ${score.rankScore}/100`,
    `- Citations: ${score.citationScore}/100`,
    `- Share of voice: ${score.shareOfVoiceScore}/100`,
    `- Sentiment: ${score.sentimentScore}/100`,
    `- Accuracy: ${score.accuracyScore}/100`,
  ].join("\n");
}

function recommendationsMarkdown(recommendations: any[]) {
  if (!recommendations?.length) return "No open recommendations are available.";
  return recommendations
    .map(
      (recommendation) =>
        `- ${recommendation.title}: ${recommendation.description} (impact ${recommendation.impactScore}, effort ${recommendation.effortScore})`,
    )
    .join("\n");
}

function groupPromptRuns(promptRuns: any[]) {
  const groups = new Map<string, { promptText: string; runs: any[] }>();
  for (const run of promptRuns) {
    const promptText = run.prompt?.text ?? "Unknown prompt";
    const key = run.prompt?.id ?? promptText;
    const group =
      groups.get(key) ??
      ({ promptText, runs: [] } as { promptText: string; runs: any[] });
    group.runs.push(run);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function listOrEmpty(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function cleanInline(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trim()}...`;
}
