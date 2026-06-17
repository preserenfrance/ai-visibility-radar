import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().min(3).optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  aliases: z.array(z.string()).optional()
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        competitors: true,
        promptSets: { orderBy: { createdAt: "desc" }, take: 1, include: { prompts: true } },
        scanRuns: { orderBy: { createdAt: "desc" }, take: 5, include: { scoreSnapshot: true } }
      }
    });
    return ok({ brand });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const input = await parseBody(request, schema);
    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...input,
        domain: input.domain ? normalizeDomain(input.domain) : undefined
      }
    });
    return ok({ brand });
  });
}
