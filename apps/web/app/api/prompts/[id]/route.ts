import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { promptLimitForOrganization } from "@/lib/billing";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  text: z.string().min(3).optional(),
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
    const { brand } = await requireBrandAccess(prompt.promptSet.brandId);
    const input = await parseBody(request, schema);
    if (input.isActive === true && !prompt.isActive) {
      const promptLimit = promptLimitForOrganization(brand.organization);
      const activePromptCount = await prisma.prompt.count({
        where: {
          promptSetId: prompt.promptSetId,
          isActive: true
        }
      });
      if (activePromptCount >= promptLimit) {
        throw new Error(`Bad Request: ta paket omogoča največ ${promptLimit} aktivnih promptov na znamko`);
      }
    }
    const updated = await prisma.prompt.update({
      where: { id },
      data: input
    });
    return ok({ prompt: updated });
  });
}
