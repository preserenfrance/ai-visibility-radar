import { crawlBrand } from "@/lib/services";
import { requireBrandAccess } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    const { searchParams } = new URL(request.url);
    const maxPages = searchParams.get("free") === "1" ? 10 : 50;
    const crawl = await crawlBrand(id, maxPages);
    return ok({ crawl }, 201);
  });
}
