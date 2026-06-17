import { requireBrandAccess } from "@/lib/auth";
import { fail, route } from "@/lib/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    await requireBrandAccess(id);
    return fail("Analiza spletne strani je izklopljena. Sistem uporablja samo uporabniško vnesene prompte.", 410);
  });
}
