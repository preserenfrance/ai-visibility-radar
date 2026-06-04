import { prisma } from "@ai-radar/db";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: { promptSet: true }
    });
    if (!prompt) throw new Error("Prompt not found");
    await requireBrandAccess(prompt.promptSet.brandId);
    const results = await prisma.promptRun.findMany({
      where: { promptId: id },
      include: { scanRun: true, engine: true, aiResponse: { include: { parsedResult: true, citations: true, mentions: true } } },
      orderBy: { createdAt: "desc" }
    });
    return ok({ prompt, results });
  });
}
