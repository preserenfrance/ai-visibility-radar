import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { createScanForBrand } from "@/lib/services";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  providers: z.array(z.enum(["openai", "google", "anthropic", "mock"])).default(["mock"]),
  promptLimit: z.number().int().min(1).max(100).optional(),
  repeatCount: z.number().int().min(1).max(3).default(1),
  runNow: z.boolean().default(true)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const input = await parseBody(request, schema);
    const scan = await createScanForBrand(id, {
      providers: input.providers,
      promptLimit: input.promptLimit,
      repeatCount: input.repeatCount,
      runNow: input.runNow
    });
    return ok({ scan }, 201);
  });
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const scans = await prisma.scanRun.findMany({
      where: { brandId: id },
      orderBy: { createdAt: "desc" },
      include: { scoreSnapshot: true }
    });
    return ok({ scans });
  });
}
