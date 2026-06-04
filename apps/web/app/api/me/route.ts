import { getCurrentUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";

export async function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    return ok({ user });
  });
}
