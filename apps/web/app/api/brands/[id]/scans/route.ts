import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { createScanForBrand } from "@/lib/services";
import { requireBrandAccess } from "@/lib/auth";
import { canRunManualScans } from "@/lib/billing";
import { ok, parseBody, route } from "@/lib/http";

export const maxDuration = 60;

const providerSchema = z.enum(["openai", "google", "anthropic"]);

const schema = z.object({
  providers: z.array(providerSchema).optional(),
  engineVariants: z
    .array(
      z.object({
        provider: providerSchema,
        searchEnabled: z.boolean().default(false),
      }),
    )
    .optional(),
  promptLimit: z.number().int().min(1).max(100).optional(),
  repeatCount: z.number().int().min(1).max(3).default(1),
  runNow: z.boolean().default(false),
  searchEnabled: z.boolean().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(async () => {
    const { id } = await context.params;
    const { brand } = await requireBrandAccess(id);
    const manualScanAccess = canRunManualScans(brand.organization);
    const input = await parseBody(request, schema);
    const scan = await createScanForBrand(id, {
      providers: manualScanAccess
        ? input.providers?.length
          ? input.providers
          : ["openai"]
        : ["openai"],
      engineVariants: manualScanAccess ? input.engineVariants : undefined,
      promptLimit: input.promptLimit,
      repeatCount: input.repeatCount,
      runNow: input.runNow,
      searchEnabled: manualScanAccess ? input.searchEnabled : false,
    });
    return ok({ scan }, 201);
  });
}

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const scans = await prisma.scanRun.findMany({
      where: { brandId: id },
      orderBy: { createdAt: "desc" },
      include: { scoreSnapshot: true },
    });
    return ok({ scans });
  });
}
