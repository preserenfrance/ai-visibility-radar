import { getCurrentUserSummary, isAdminUser } from "@/lib/auth";
import { userHasAgencyAccess } from "@/lib/agency";
import { ok, route } from "@/lib/http";

export async function GET() {
  return route(async () => {
    const user = await getCurrentUserSummary();
    const isAgencyUser = user ? await userHasAgencyAccess(user.id) : false;
    return ok({ user, isAdmin: isAdminUser(user), isAgencyUser });
  });
}
