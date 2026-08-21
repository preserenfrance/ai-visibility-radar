import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Target,
} from "lucide-react";
import { TrackedAnchor } from "@/components/analytics-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OnboardingStep, OnboardingSummary } from "@/lib/onboarding";

export function OnboardingChecklist({
  summary,
  compact = false,
  location,
}: {
  summary: OnboardingSummary;
  compact?: boolean;
  location: string;
}) {
  const visibleSteps = compact
    ? summary.steps
        .filter((step) => step !== summary.nextStep && !step.completed)
        .slice(0, 2)
    : summary.steps;

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {compact ? "Brand onboarding" : "Brand onboarding path"}
            </CardTitle>
            <CardDescription>
              {summary.completedCount}/{summary.totalCount} steps complete
              {` for ${summary.stats.brandName}`}
            </CardDescription>
          </div>
          <div className="min-w-36 text-right">
            <div className="text-2xl font-semibold">
              {summary.completionPercent}%
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${summary.completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {summary.nextStep && compact && (
          <div className="mb-4 rounded-md border bg-primary/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-primary">
                  Next best action
                </div>
                <div className="mt-1 font-semibold">
                  {summary.nextStep.title}
                </div>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  {summary.nextStep.description}
                </p>
              </div>
              <StepButton step={summary.nextStep} location={location} primary />
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {visibleSteps.map((step) => (
            <StepRow key={step.key} step={step} location={location} />
          ))}
        </div>

        {compact && (
          <div className="mt-4 flex justify-end border-t pt-4">
            <Button asChild variant="outline" size="sm">
              <TrackedAnchor
                href={`/app/brands/${summary.stats.brandId}`}
                eventName="onboarding_overview_click"
                eventProperties={{
                  brand_id: summary.stats.brandId,
                  location,
                  completion_percent: summary.completionPercent,
                }}
              >
                Open brand
                <ArrowRight className="h-4 w-4" />
              </TrackedAnchor>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepRow({
  step,
  location,
}: {
  step: OnboardingStep;
  location: string;
}) {
  return (
    <div
      className={[
        "grid gap-3 rounded-md border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
        step.completed ? "border-emerald-200 bg-emerald-50/40" : "",
        step.locked && !step.completed ? "opacity-75" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex min-w-0 gap-3">
        <StepIcon step={step} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{step.title}</h3>
            <Badge variant={step.completed ? "success" : "secondary"}>
              {step.completed ? "done" : step.metric}
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {step.description}
          </p>
        </div>
      </div>
      <StepButton step={step} location={location} />
    </div>
  );
}

function StepIcon({ step }: { step: OnboardingStep }) {
  if (step.completed) {
    return (
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
    );
  }

  if (step.locked) {
    return (
      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
    );
  }

  return <Circle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />;
}

function StepButton({
  step,
  location,
  primary = false,
}: {
  step: OnboardingStep;
  location: string;
  primary?: boolean;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant={primary || !step.completed ? "default" : "outline"}
      className="w-fit"
    >
      <TrackedAnchor
        href={step.href}
        eventName="onboarding_step_click"
        eventProperties={{
          step: step.key,
          completed: step.completed,
          locked: step.locked,
          location,
        }}
      >
        {step.completed ? "Open" : step.cta}
        <ArrowRight className="h-4 w-4" />
      </TrackedAnchor>
    </Button>
  );
}
