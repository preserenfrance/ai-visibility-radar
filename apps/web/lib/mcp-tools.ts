import { prisma } from "@ai-radar/db";
import { domainFromUrl } from "@ai-radar/shared";
import type { McpAuthContext, McpScope } from "@/lib/mcp-tokens";

type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  requiredScopes: McpScope[];
};

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "get_account_context",
    description:
      "List the authenticated AI Radar user and organizations available to this MCP token.",
    inputSchema: emptySchema(),
    requiredScopes: ["brands:read"],
  },
  {
    name: "list_brands",
    description:
      "List AI Radar brands the authenticated user can access, including the latest visibility score when available.",
    inputSchema: emptySchema(),
    requiredScopes: ["brands:read"],
  },
  {
    name: "get_brand_overview",
    description:
      "Get a concise overview of one AI Radar brand, its competitors, latest score, and latest scan status.",
    inputSchema: objectSchema(
      {
        brandId: {
          type: "string",
          description: "AI Radar brand ID.",
        },
      },
      ["brandId"],
    ),
    requiredScopes: ["brands:read"],
  },
  {
    name: "get_latest_scan",
    description:
      "Get the latest scan run for a brand, including score breakdown and prompt-run completion counts.",
    inputSchema: objectSchema(
      {
        brandId: {
          type: "string",
          description: "AI Radar brand ID.",
        },
      },
      ["brandId"],
    ),
    requiredScopes: ["scans:read"],
  },
  {
    name: "get_prompt_results",
    description:
      "Get prompt-level model answers, citations, mentions, and parsed outcomes for a scan run.",
    inputSchema: objectSchema({
      scanRunId: {
        type: "string",
        description: "AI Radar scan run ID. If omitted, brandId is used.",
      },
      brandId: {
        type: "string",
        description:
          "Brand ID used to find the latest scan when scanRunId is omitted.",
      },
      limit: {
        type: "number",
        description: "Maximum prompt runs to return. Defaults to 20, max 100.",
      },
    }),
    requiredScopes: ["scans:read"],
  },
  {
    name: "get_search_traces",
    description:
      "Get provider search queries captured for a scan run, including source domains consulted by AI models.",
    inputSchema: objectSchema({
      scanRunId: {
        type: "string",
        description: "AI Radar scan run ID. If omitted, brandId is used.",
      },
      brandId: {
        type: "string",
        description:
          "Brand ID used to find the latest scan when scanRunId is omitted.",
      },
      limit: {
        type: "number",
        description:
          "Maximum search traces to return. Defaults to 50, max 200.",
      },
    }),
    requiredScopes: ["search_traces:read"],
  },
];

export function mcpToolByName(name: string) {
  return MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name);
}

export async function callMcpTool(
  name: string,
  args: unknown,
  context: McpAuthContext,
) {
  switch (name) {
    case "get_account_context":
      return getAccountContext(context);
    case "list_brands":
      return listBrands(context);
    case "get_brand_overview":
      return getBrandOverview(context, requireStringArg(args, "brandId"));
    case "get_latest_scan":
      return getLatestScan(context, requireStringArg(args, "brandId"));
    case "get_prompt_results":
      return getPromptResults(context, args);
    case "get_search_traces":
      return getSearchTraces(context, args);
    default:
      throw new Error(`Bad Request: unknown MCP tool ${name}`);
  }
}

function getAccountContext(context: McpAuthContext) {
  return {
    user: {
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
    },
    organizations: context.user.memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      plan: membership.organization.plan,
    })),
    scopes: context.scopes,
  };
}

async function listBrands(context: McpAuthContext) {
  const brands = await prisma.brand.findMany({
    where: { organizationId: { in: organizationIds(context) } },
    select: {
      id: true,
      organizationId: true,
      name: true,
      domain: true,
      industry: true,
      country: true,
      language: true,
      updatedAt: true,
      organization: { select: { id: true, name: true, plan: true } },
      scoreSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          visibilityScore: true,
          mentionScore: true,
          citationScore: true,
          shareOfVoiceScore: true,
          sentimentScore: true,
          accuracyScore: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      domain: brand.domain,
      industry: brand.industry,
      country: brand.country,
      language: brand.language,
      organization: brand.organization,
      latestScore: brand.scoreSnapshots[0] ?? null,
    })),
  };
}

async function getBrandOverview(context: McpAuthContext, brandId: string) {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, organizationId: { in: organizationIds(context) } },
    include: {
      organization: { select: { id: true, name: true, plan: true } },
      competitors: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, domain: true, description: true },
      },
      scoreSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      scanRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          triggerType: true,
          totalPromptRuns: true,
          completedPromptRuns: true,
          failedPromptRuns: true,
          createdAt: true,
          finishedAt: true,
        },
      },
    },
  });
  if (!brand) throw new Error("Forbidden: brand access required");

  return {
    brand: {
      id: brand.id,
      name: brand.name,
      domain: brand.domain,
      description: brand.description,
      industry: brand.industry,
      country: brand.country,
      language: brand.language,
      organization: brand.organization,
      competitors: brand.competitors,
      latestScore: brand.scoreSnapshots[0] ?? null,
      latestScan: brand.scanRuns[0] ?? null,
    },
  };
}

async function getLatestScan(context: McpAuthContext, brandId: string) {
  await assertBrandAccess(context, brandId);
  const scan = await prisma.scanRun.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      promptSet: {
        select: { id: true, name: true, language: true, country: true },
      },
      scoreSnapshot: true,
    },
  });
  return { scan };
}

async function getPromptResults(context: McpAuthContext, args: unknown) {
  const scan = await scanForArgs(context, args);
  const limit = numberArg(args, "limit", 20, 1, 100);
  const promptRuns = await prisma.promptRun.findMany({
    where: { scanRunId: scan.id },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      prompt: true,
      engine: true,
      aiResponse: {
        include: {
          parsedResult: true,
          citations: true,
          mentions: true,
        },
      },
    },
  });

  return {
    scan: scanSummary(scan),
    promptRuns: promptRuns.map((run) => ({
      id: run.id,
      status: run.status,
      prompt: run.prompt.text,
      engine: {
        provider: run.engine.provider,
        name: run.engine.engineName,
        model: run.engine.model,
        searchEnabled: run.engine.searchEnabled,
      },
      answer: run.aiResponse?.rawText ?? null,
      parsed: run.aiResponse?.parsedResult?.parsedJson ?? null,
      citations:
        run.aiResponse?.citations.map((citation) => ({
          url: citation.url,
          domain: citation.domain,
          title: citation.title,
          isOwnedDomain: citation.isOwnedDomain,
          isCompetitorDomain: citation.isCompetitorDomain,
          supportsBrand: citation.supportsBrand,
          supportsCompetitor: citation.supportsCompetitor,
        })) ?? [],
      mentions:
        run.aiResponse?.mentions.map((mention) => ({
          entityName: mention.entityName,
          entityType: mention.entityType,
          rankPosition: mention.rankPosition,
          sentiment: mention.sentiment,
          evidenceText: mention.evidenceText,
          confidence: mention.confidence,
        })) ?? [],
    })),
  };
}

async function getSearchTraces(context: McpAuthContext, args: unknown) {
  const scan = await scanForArgs(context, args);
  const limit = numberArg(args, "limit", 50, 1, 200);
  const promptRuns = await prisma.promptRun.findMany({
    where: { scanRunId: scan.id },
    orderBy: { createdAt: "asc" },
    include: {
      prompt: true,
      engine: true,
      aiResponse: {
        include: {
          searchCalls: {
            orderBy: { createdAt: "asc" },
            take: limit,
          },
        },
      },
    },
  });

  const traces = promptRuns.flatMap((run) =>
    (run.aiResponse?.searchCalls ?? []).map((call) => ({
      id: call.id,
      promptRunId: run.id,
      prompt: run.prompt.text,
      engine: {
        provider: run.engine.provider,
        name: run.engine.engineName,
        model: run.engine.model,
        searchEnabled: run.engine.searchEnabled,
      },
      provider: call.provider,
      actionType: call.actionType,
      query: call.query,
      exact: call.exact,
      sources: searchSources(call.sourcesJson),
      createdAt: call.createdAt,
    })),
  );

  return {
    scan: scanSummary(scan),
    traces: traces.slice(0, limit),
  };
}

async function scanForArgs(context: McpAuthContext, args: unknown) {
  const scanRunId = optionalStringArg(args, "scanRunId");
  if (scanRunId) {
    const scan = await prisma.scanRun.findFirst({
      where: {
        id: scanRunId,
        brand: { organizationId: { in: organizationIds(context) } },
      },
      include: {
        brand: { select: { id: true, name: true, domain: true } },
        scoreSnapshot: true,
      },
    });
    if (!scan) throw new Error("Forbidden: scan access required");
    return scan;
  }

  const brandId = requireStringArg(args, "brandId");
  await assertBrandAccess(context, brandId);
  const scan = await prisma.scanRun.findFirst({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      scoreSnapshot: true,
    },
  });
  if (!scan) throw new Error("Bad Request: no scan found for brand");
  return scan;
}

async function assertBrandAccess(context: McpAuthContext, brandId: string) {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, organizationId: { in: organizationIds(context) } },
    select: { id: true },
  });
  if (!brand) throw new Error("Forbidden: brand access required");
}

function scanSummary(scan: {
  id: string;
  status: string;
  triggerType: string;
  totalPromptRuns: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
  createdAt: Date;
  finishedAt: Date | null;
  brand: { id: string; name: string; domain: string };
  scoreSnapshot: unknown;
}) {
  return {
    id: scan.id,
    status: scan.status,
    triggerType: scan.triggerType,
    brand: scan.brand,
    totalPromptRuns: scan.totalPromptRuns,
    completedPromptRuns: scan.completedPromptRuns,
    failedPromptRuns: scan.failedPromptRuns,
    score: scan.scoreSnapshot,
    createdAt: scan.createdAt,
    finishedAt: scan.finishedAt,
  };
}

function organizationIds(context: McpAuthContext) {
  return context.user.memberships.map(
    (membership) => membership.organizationId,
  );
}

function requireStringArg(args: unknown, key: string) {
  const value = optionalStringArg(args, key);
  if (!value) throw new Error(`Bad Request: ${key} is required`);
  return value;
}

function optionalStringArg(args: unknown, key: string) {
  if (!args || typeof args !== "object") return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberArg(
  args: unknown,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  if (!args || typeof args !== "object") return fallback;
  const raw = (args as Record<string, unknown>)[key];
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function searchSources(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((source): source is Record<string, unknown> =>
      Boolean(source && typeof source === "object" && source.url),
    )
    .map((source) => {
      const url = String(source.url);
      return {
        url,
        title: source.title ? String(source.title) : undefined,
        domain: source.domain
          ? String(source.domain)
          : (domainFromUrl(url) ?? undefined),
      };
    });
}

function emptySchema(): JsonSchema {
  return objectSchema();
}

function objectSchema(
  properties: Record<string, unknown> = {},
  required: string[] = [],
): JsonSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}
