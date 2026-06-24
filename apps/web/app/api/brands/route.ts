import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { PLAN_LIMITS } from "@ai-radar/usage";
import { normalizeDomain } from "@ai-radar/shared";
import { requireCurrentUser, requireOrganizationAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import {
  generateBrandChatGptSummarySafely,
  recurringScanActivationData,
} from "@/lib/services";

export const maxDuration = 60;

const schema = z.object({
  organizationId: z.string(),
  name: z.string().min(1),
  domain: z.string().min(3),
  description: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().default("Slovenia"),
  language: z.string().default("sl"),
  aliases: z.array(z.string()).optional(),
});

export async function GET() {
  return route(async () => {
    const user = await requireCurrentUser();
    const brands = await prisma.brand.findMany({
      where: {
        organization: {
          memberships: { some: { userId: user.id } },
        },
      },
      include: {
        competitors: true,
        scoreSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ brands });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const { user } = await requireOrganizationAccess(input.organizationId);
    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      include: { _count: { select: { brands: true } } },
    });
    if (!organization) throw new Error("Organization not found");
    const brandLimit = PLAN_LIMITS[organization.plan].brandCount;
    if (organization._count.brands >= brandLimit) {
      throw new Error(
        `Bad Request: ta paket omogoča največ ${brandLimit} znamk.`,
      );
    }
    const normalizedDomain = normalizeDomain(input.domain);
    const chatGptBrandSummary = await generateBrandChatGptSummarySafely({
      name: input.name,
      domain: normalizedDomain,
      description: input.description,
      industry: input.industry,
      country: input.country,
      language: input.language,
    });
    const recurringScanData = recurringScanActivationData(organization.plan);
    const brand = await prisma.brand.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        domain: normalizedDomain,
        description: input.description,
        chatGptBrandSummary,
        chatGptBrandSummaryUpdatedAt: chatGptBrandSummary
          ? new Date()
          : undefined,
        industry: input.industry,
        country: input.country,
        language: input.language,
        aliases: input.aliases ?? [],
        ...(recurringScanData ?? {}),
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: user.id,
        action: "brand_created",
        entityType: "Brand",
        entityId: brand.id,
      },
    });
    return ok({ brand }, 201);
  });
}
