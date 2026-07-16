import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { promptLimitForOrganization } from "@/lib/billing";
import { fail, ok, route } from "@/lib/http";
import {
  suggestPromptGaps,
  type PromptGapRun,
} from "@/lib/prompt-gap-suggestions";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(async () => {
    const { id } = await context.params;
    const access = await requireBrandAccess(id);
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        competitors: true,
        promptSets: {
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            prompts: {
              orderBy: { priority: "asc" },
            },
          },
        },
        scanRuns: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            promptRuns: {
              orderBy: { createdAt: "desc" },
              take: 80,
              include: {
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
              },
            },
          },
        },
      },
    });
    if (!brand) return fail("Brand not found", 404);

    const activePromptSet = brand.promptSets[0];
    const activePrompts =
      activePromptSet?.prompts.filter((prompt) => prompt.isActive) ?? [];
    const promptLimit = promptLimitForOrganization(access.brand.organization);
    const availablePromptSlots = promptLimit - activePrompts.length;
    if (availablePromptSlots <= 0) {
      return fail(
        `This plan allows up to ${promptLimit} active prompts per brand.`,
        400,
      );
    }

    const suggestions = await suggestPromptGaps({
      brandName: brand.name,
      domain: brand.domain,
      industry: brand.industry,
      country: brand.country,
      language: brand.language,
      competitors: brand.competitors,
      existingPrompts: activePrompts.map((prompt) => prompt.text),
      latestRuns: promptGapRuns(brand.scanRuns),
      maxSuggestions: Math.min(5, availablePromptSlots),
    });

    return ok({ suggestions });
  });
}

function promptGapRuns(scanRuns: Array<any>): PromptGapRun[] {
  return scanRuns
    .flatMap((scan) => scan.promptRuns)
    .map((run) => ({
      prompt: run.prompt.text,
      engineName: run.engine.engineName,
      brandMentioned: run.aiResponse?.parsedResult?.brandMentioned ?? null,
      brandRank: run.aiResponse?.parsedResult?.brandRank ?? null,
      mentionCount: run.aiResponse?.parsedResult?.mentionCount ?? 0,
      competitors: (run.aiResponse?.mentions ?? [])
        .filter((mention: any) => mention.entityType === "competitor")
        .map((mention: any) => mention.entityName),
      citations: (run.aiResponse?.citations ?? []).map(
        (citation: any) => citation.domain,
      ),
      searchQueries: (run.aiResponse?.searchCalls ?? []).map(
        (call: any) => call.query,
      ),
    }))
    .slice(0, 80);
}
