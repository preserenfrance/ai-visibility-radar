import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  text: z.string().min(3).optional(),
  category: z.string().optional(),
  intent: z.string().optional(),
  persona: z.string().optional(),
  funnelStage: z.string().optional(),
  priority: z.number().int().min(1).optional(),
  isActive: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: { promptSet: true }
    });
    if (!prompt) throw new Error("Prompt not found");
    await requireBrandAccess(prompt.promptSet.brandId);
    const input = await parseBody(request, schema);
    const updated = await prisma.prompt.update({
      where: { id },
      data: input
    });
    return ok({ prompt: updated });
  });
}
