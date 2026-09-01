import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { accessibleBrandWhereForUser } from "@/lib/agency";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/onboarding");

  const brand = await prisma.brand.findFirst({
    where: {
      ...accessibleBrandWhereForUser(user.id),
      organization: {
        plan: { not: "disabled" },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  redirect(brand ? `/app/brands/${brand.id}` : "/app/dashboard");
}
