import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { normalizeDomain } from "@ai-radar/shared";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  description: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const input = await parseBody(request, schema);
    const competitor = await prisma.competitor.create({
      data: {
        brandId: id,
        name: input.name,
        domain: input.domain ? normalizeDomain(input.domain) : undefined,
        description: input.description
      }
    });
    return ok({ competitor }, 201);
  });
}
