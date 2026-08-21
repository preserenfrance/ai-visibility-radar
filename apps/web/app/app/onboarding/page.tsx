import { redirect } from "next/navigation";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { getUserOnboardingSummary } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/app/onboarding");

  const summary = await getUserOnboardingSummary(user.id);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Onboarding</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          A practical path from first setup to recurring AI visibility
          measurement.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Brands" value={summary.stats.brandCount} />
        <MetricCard
          label="Active prompts"
          value={summary.stats.activePromptCount}
        />
        <MetricCard
          label="Completed scans"
          value={summary.stats.completedScanCount}
        />
        <MetricCard label="Citations" value={summary.stats.citationCount} />
      </div>

      <OnboardingChecklist summary={summary} location="onboarding_page" />
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">
          {value.toLocaleString("en-US")}
        </div>
      </CardContent>
    </Card>
  );
}
