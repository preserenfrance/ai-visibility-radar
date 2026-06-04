import { z } from "zod";
import { generatePromptsForBrand } from "@/lib/services";
import { requireBrandAccess } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  count: z.number().int().min(1).max(100).default(25)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const input = await parseBody(request, schema);
    const promptSet = await generatePromptsForBrand(id, input.count);
    return ok({ promptSet }, 201);
  });
}
