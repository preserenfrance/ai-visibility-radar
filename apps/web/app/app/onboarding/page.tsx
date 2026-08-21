import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/onboarding");

  const brand = await prisma.brand.findFirst({
    where: {
      organization: {
        plan: { not: "disabled" },
        memberships: { some: { userId: user.id } },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  redirect(brand ? `/app/brands/${brand.id}` : "/app/dashboard");
}
