import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  MessageSquareQuote,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrackedAnchor } from "@/components/analytics-events";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";

const featureIcons = [
  Activity,
  Target,
  BadgeCheck,
  Sparkles,
  ClipboardList,
  ShieldCheck,
] as const;

export default async function HomePage() {
  const { dictionary } = await getI18n();
  const home = dictionary.home;

  return (
    <main>
      <section className="relative min-h-[92vh] overflow-hidden bg-slate-950 text-white">
        <Image
          src="/images/ai-visibility-radar-hero.png"
          alt="Nadzorna plošča AI Visibility Radar na prenosniku"
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/15" />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col px-5 py-5">
          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-sm bg-white/10 px-3 py-1 text-sm">
                <SearchCheck className="h-4 w-4 text-accent" />
                {home.eyebrow}
              </p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
                {home.headline}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">
                {home.intro}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="default">
                  <TrackedAnchor
                    href="/ai-visibility-checker"
                    eventName="first_scan_cta_click"
                    eventProperties={{ location: "home_hero" }}
                  >
                    {home.primaryCta} <ArrowRight className="h-4 w-4" />
                  </TrackedAnchor>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/40 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href="/app/dashboard">{home.appCta}</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div>
                  <p className="text-sm text-slate-300">{home.sampleEyebrow}</p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {home.sampleTitle}
                  </h2>
                </div>
                <Badge className="bg-accent/20 text-amber-100">
                  {home.live}
                </Badge>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {home.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-md border border-white/15 bg-slate-950/45 p-4"
                  >
                    <div className="text-2xl font-semibold">{metric.value}</div>
                    <div className="mt-1 text-sm text-slate-300">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-200">
                {home.heroChecks.map((item) => (
                  <HeroCheck key={item}>{item}</HeroCheck>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Badge variant="secondary">{home.measureEyebrow}</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal">
              {home.measureTitle}
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              {home.measureText}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {home.features.map(({ title, description }, index) => {
              const Icon = featureIcons[index] ?? Activity;
              return (
                <Card key={title}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" /> {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="max-w-2xl">
          <Badge variant="secondary">{home.sectionStepsEyebrow}</Badge>
          <h2 className="mt-4 text-3xl font-semibold">
            {home.sectionStepsTitle}
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            {home.sectionStepsText}
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {home.steps.map((step, index) => (
            <Card key={step.title}>
              <CardHeader>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[1fr_1fr]">
          <div>
            <Badge className="bg-white/10 text-white">
              {home.resultsEyebrow}
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold">{home.resultsTitle}</h2>
            <p className="mt-4 leading-7 text-slate-300">{home.resultsText}</p>
            <div className="mt-6 grid gap-3">
              {home.resultChecks.map((item) => (
                <DarkCheck key={item}>{item}</DarkCheck>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-5">
            <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-4">
              <div>
                <p className="text-sm text-slate-300">{home.scoreTitle}</p>
                <div className="mt-1 text-5xl font-semibold">
                  72<span className="text-2xl text-slate-300">/100</span>
                </div>
              </div>
              <TrendingUp className="h-10 w-10 text-accent" />
            </div>
            <div className="mt-5 grid gap-3">
              {home.scoreRows.map((row) => (
                <ScoreRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Badge variant="secondary">{home.useCasesEyebrow}</Badge>
          <h2 className="mt-4 text-3xl font-semibold">{home.useCasesTitle}</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            {home.useCasesText}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <TrackedAnchor
                href="/ai-visibility-checker"
                eventName="first_scan_cta_click"
                eventProperties={{ location: "home_use_cases" }}
              >
                {home.checkQuestions}
              </TrackedAnchor>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">{home.seePricing}</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          {home.useCases.map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-lg border bg-white p-4"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-6">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Badge variant="secondary">{home.reviewsEyebrow}</Badge>
              <h2 className="mt-4 text-3xl font-semibold">
                {home.reviewsTitle}
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                {home.reviewsText}
              </p>
            </div>
            <Button asChild variant="outline">
              <TrackedAnchor
                href="/ai-visibility-checker"
                eventName="first_scan_cta_click"
                eventProperties={{ location: "home_reviews" }}
              >
                {home.startFirstScan}
              </TrackedAnchor>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {home.reviews.map((review) => (
              <Card key={review.name}>
                <CardHeader>
                  <div
                    className="mb-3 flex gap-1 text-accent"
                    aria-label={`${review.rating} od 5 zvezdic`}
                  >
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <MessageSquareQuote className="h-5 w-5 text-primary" />
                  <CardDescription className="pt-2 text-base leading-7 text-foreground">
                    “{review.text}”
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-medium">{review.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {review.company}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-8 rounded-lg border bg-slate-950 p-6 text-white md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
              <BarChart3 className="h-4 w-4 text-accent" />
              {home.bottomEyebrow}
            </div>
            <h2 className="text-3xl font-semibold">{home.bottomTitle}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-300">
              {home.bottomText}
            </p>
          </div>
          <Button
            asChild
            size="default"
            className="bg-white text-slate-950 hover:bg-slate-200"
          >
            <TrackedAnchor
              href="/ai-visibility-checker"
              eventName="first_scan_cta_click"
              eventProperties={{ location: "home_bottom_cta" }}
            >
              {home.startFirstScan} <ArrowRight className="h-4 w-4" />
            </TrackedAnchor>
          </Button>
        </div>
      </section>
    </main>
  );
}

function HeroCheck({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-accent" />
      <span>{children}</span>
    </div>
  );
}

function DarkCheck({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>{children}</span>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-slate-950/45 px-4 py-3 text-sm">
      <span className="text-slate-300">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}
