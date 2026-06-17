import { requireBrandAccess } from "@/lib/auth";
import { fail, route } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    return fail("Samodejno generiranje promptov je izklopljeno. Uporabi uporabniško vnesene prompte.", 410);
  });
}
