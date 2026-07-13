import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getConfig } from "@ai-radar/config";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  MessageSquareQuote,
  Plug,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";

const landingContent = {
  sl: {
    metaTitle: "MCP dostop | AI Visibility Radar",
    metaDescription:
      "Povezi AI Visibility Radar z MCP odjemalci in vprašaj svoje podatke o znamkah, scanih, citatih, konkurentih in fan-out iskalnih sledeh.",
    eyebrow: "MCP za AI asistente",
    title: "AI Visibility Radar MCP",
    intro:
      "Poveži svoje podatke iz Radarja z ChatGPT, Claude, Cursorjem ali drugim MCP odjemalcem. Asistent lahko nato varno bere tvoje znamke, zadnje AI visibility scane, prompt rezultate, citate in zajete fan-out iskalne termine.",
    primaryCta: "Ustvari MCP token",
    secondaryCta: "Začni prvi pregled",
    statEndpoint: "Endpoint",
    statAuth: "Auth",
    statMode: "Način",
    statAuthValue: "Bearer token",
    statModeValue: "Read-only",
    bridgeEyebrow: "Zakaj MCP",
    bridgeTitle:
      "Tvoji AI visibility podatki postanejo uporabni v vsakem AI delovnem toku.",
    bridgeText:
      "Namesto ročnega odpiranja dashboarda lahko asistentu neposredno naročiš, naj pregleda zadnji scan, povzame vire, najde šibka vprašanja ali primerja konkurente. MCP je standardni most med AI odjemalcem in tvojim računom.",
    setupEyebrow: "Priklop",
    setupTitle: "Prva faza uporablja osebni token, brez OAuth.",
    setupText:
      "V nastavitvah ustvariš MCP token, ga shraniš v svoj MCP odjemalec in kot endpoint uporabiš spodnji URL. Token je prikazan samo enkrat in ga lahko kadarkoli prekličeš.",
    endpointLabel: "MCP endpoint",
    headerLabel: "HTTP header",
    toolsEyebrow: "Orodja",
    toolsTitle: "Kaj lahko asistent prebere iz Radarja",
    examplesEyebrow: "Primeri vprašanj",
    examplesTitle: "Uporaba je naravna: vprašaš asistenta, ne dashboarda.",
    securityEyebrow: "Varnost",
    securityTitle: "Zasnovano kot omejen, preklicljiv read-only dostop.",
    securityText:
      "Tokeni ne izvajajo scanov, ne spreminjajo znamk in ne urejajo obračuna. Namen prve faze je varen vpogled v obstoječe podatke; OAuth lahko pride kasneje za javno distribucijo in ekipne namestitve.",
    finalTitle: "Priklopi Radar v svoj AI delovni prostor.",
    finalText:
      "Naj asistent bere rezultate, najde fan-out query sledi in pripravi naslednje vsebinske naloge brez ročnega kopiranja iz aplikacije.",
    benefits: [
      {
        title: "Analiza brez izvoza",
        description:
          "Vprašaj asistenta po zadnjem scanu, trendih, omembah in citiranih virih, brez CSV izvoza ali copy-paste dela.",
      },
      {
        title: "Fan-out query sledi",
        description:
          "Pri search-enabled scanih lahko vidiš zajete iskalne termine in domene, ki jih je model uporabil kot del raziskovanja.",
      },
      {
        title: "Kontekst znamke",
        description:
          "AI odjemalec dobi strukturiran seznam znamk, konkurentov, promptov, odgovorov, citatov in parsed rezultatov.",
      },
    ],
    steps: [
      {
        title: "Ustvari token",
        description:
          "V aplikaciji odpri Settings in v MCP access ustvari nov osebni token za svoj AI odjemalec.",
      },
      {
        title: "Dodaj endpoint",
        description:
          "V MCP odjemalcu nastavi HTTP endpoint in dodaj Authorization header z ustvarjenim tokenom.",
      },
      {
        title: "Izberi znamko",
        description:
          "Asistent naj najprej pokliče list_brands ali get_account_context, da ve, do katerih podatkov ima dostop.",
      },
      {
        title: "Analiziraj rezultate",
        description:
          "Vprašaj po zadnjem scanu, prompt odgovorih, citatih, konkurentih ali search trace podatkih.",
      },
    ],
    tools: [
      {
        name: "get_account_context",
        description: "Uporabnik, organizacije in scope-i trenutnega tokena.",
      },
      {
        name: "list_brands",
        description: "Seznam znamk in zadnja ocena AI vidnosti, kjer obstaja.",
      },
      {
        name: "get_brand_overview",
        description: "Pregled znamke, konkurentov, zadnjega scana in score-a.",
      },
      {
        name: "get_latest_scan",
        description: "Zadnji scan run s statusom in razčlenitvijo rezultata.",
      },
      {
        name: "get_prompt_results",
        description:
          "Prompti, odgovori modelov, citati, omembe in parsed izid.",
      },
      {
        name: "get_search_traces",
        description:
          "Zajeti search/fan-out termini in uporabljeni source domaini.",
      },
    ],
    examples: [
      "Povzemi zadnji AI visibility scan za našo glavno znamko in izpiši tri prioritete.",
      "Katera vprašanja nas ne omenjajo, konkurente pa postavijo na prvo mesto?",
      "Pokaži fan-out query sledi in domene, ki jih modeli uporabljajo kot vire.",
      "Pripravi content brief za najšibkejši prompt iz zadnjega scana.",
    ],
    security: [
      "Token je shranjen samo kot hash; polna vrednost je prikazana enkrat.",
      "Scope-i so omejeni na brands:read, scans:read in search_traces:read.",
      "Dostop lahko prekličeš v Settings brez spreminjanja gesla ali računa.",
    ],
  },
  en: {
    metaTitle: "MCP access | AI Visibility Radar",
    metaDescription:
      "Connect AI Visibility Radar to MCP clients and query your brands, scans, citations, competitors and captured fan-out search traces.",
    eyebrow: "MCP for AI assistants",
    title: "AI Visibility Radar MCP",
    intro:
      "Connect your Radar data to ChatGPT, Claude, Cursor or any MCP-capable client. Your assistant can safely read brands, latest AI visibility scans, prompt results, citations and captured fan-out search terms.",
    primaryCta: "Create MCP token",
    secondaryCta: "Start first audit",
    statEndpoint: "Endpoint",
    statAuth: "Auth",
    statMode: "Mode",
    statAuthValue: "Bearer token",
    statModeValue: "Read-only",
    bridgeEyebrow: "Why MCP",
    bridgeTitle:
      "Your AI visibility data becomes useful inside every AI workflow.",
    bridgeText:
      "Instead of opening the dashboard manually, ask your assistant to review the latest scan, summarize sources, find weak questions or compare competitors. MCP is the standard bridge between an AI client and your account.",
    setupEyebrow: "Connection",
    setupTitle: "The first phase uses a personal token, no OAuth required.",
    setupText:
      "Create an MCP token in settings, save it in your MCP client and use the endpoint below. The token is shown only once and can be revoked at any time.",
    endpointLabel: "MCP endpoint",
    headerLabel: "HTTP header",
    toolsEyebrow: "Tools",
    toolsTitle: "What an assistant can read from Radar",
    examplesEyebrow: "Example prompts",
    examplesTitle: "Use it naturally: ask the assistant, not the dashboard.",
    securityEyebrow: "Security",
    securityTitle: "Built as narrow, revocable read-only access.",
    securityText:
      "Tokens do not run scans, change brands or manage billing. The first phase is a safe way to read existing data; OAuth can come later for public distribution and team installs.",
    finalTitle: "Connect Radar to your AI workspace.",
    finalText:
      "Let your assistant read results, find fan-out query traces and draft next content tasks without manually copying from the app.",
    benefits: [
      {
        title: "Analysis without exports",
        description:
          "Ask your assistant about the latest scan, trends, mentions and cited sources without CSV exports or copy-paste work.",
      },
      {
        title: "Fan-out query traces",
        description:
          "For search-enabled scans, inspect captured search terms and domains the model used during its research step.",
      },
      {
        title: "Brand context",
        description:
          "The AI client receives structured brands, competitors, prompts, answers, citations and parsed results.",
      },
    ],
    steps: [
      {
        title: "Create a token",
        description:
          "Open Settings in the app and create a personal MCP token for your AI client.",
      },
      {
        title: "Add the endpoint",
        description:
          "Configure your MCP client with the HTTP endpoint and an Authorization header containing the token.",
      },
      {
        title: "Select a brand",
        description:
          "Ask the assistant to call list_brands or get_account_context first so it knows what data it can access.",
      },
      {
        title: "Analyze results",
        description:
          "Ask for the latest scan, prompt answers, citations, competitors or search trace data.",
      },
    ],
    tools: [
      {
        name: "get_account_context",
        description: "Current user, organizations and token scopes.",
      },
      {
        name: "list_brands",
        description:
          "Available brands and latest AI visibility score when present.",
      },
      {
        name: "get_brand_overview",
        description: "Brand, competitors, latest scan and score overview.",
      },
      {
        name: "get_latest_scan",
        description: "Latest scan run with status and score breakdown.",
      },
      {
        name: "get_prompt_results",
        description:
          "Prompts, model answers, citations, mentions and parsed output.",
      },
      {
        name: "get_search_traces",
        description: "Captured search/fan-out terms and source domains.",
      },
    ],
    examples: [
      "Summarize the latest AI visibility scan for our main brand and list three priorities.",
      "Which questions fail to mention us but rank competitors first?",
      "Show fan-out query traces and domains the models use as sources.",
      "Draft a content brief for the weakest prompt in the latest scan.",
    ],
    security: [
      "The token is stored only as a hash; the full value is shown once.",
      "Scopes are limited to brands:read, scans:read and search_traces:read.",
      "Access can be revoked in Settings without changing the password or account.",
    ],
  },
} as const;

const benefitIcons = [Sparkles, SearchCheck, Target] as const;
const stepIcons = [KeyRound, Plug, MessageSquareQuote, BarChart3] as const;
const toolIcons = [
  BadgeCheck,
  Activity,
  Target,
  BarChart3,
  ClipboardList,
  SearchCheck,
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const page = landingContent[locale];

  return {
    title: page.metaTitle,
    description: page.metaDescription,
  };
}

export default async function McpAccessPage() {
  const { locale } = await getI18n();
  const page = landingContent[locale];
  const endpoint = `${getConfig().NEXT_PUBLIC_APP_URL}/mcp`;

  return (
    <main>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <Image
          src="/images/ai-visibility-radar-hero.png"
          alt=""
          fill
          priority
          className="object-cover opacity-55"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/35" />
        <div className="relative z-10 mx-auto flex min-h-[72vh] max-w-7xl flex-col justify-center px-5 py-16 sm:py-20">
          <Badge className="w-fit bg-white/10 text-white">
            <Plug className="mr-2 h-3.5 w-3.5 text-accent" />
            {page.eyebrow}
          </Badge>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            {page.intro}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/app/settings">
                {page.primaryCta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/40 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/ai-visibility-checker">{page.secondaryCta}</Link>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
            <HeroStat label={page.statEndpoint} value="/mcp" />
            <HeroStat label={page.statAuth} value={page.statAuthValue} />
            <HeroStat label={page.statMode} value={page.statModeValue} />
          </dl>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Badge variant="secondary">{page.bridgeEyebrow}</Badge>
            <h2 className="mt-4 text-3xl font-semibold leading-tight">
              {page.bridgeTitle}
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              {page.bridgeText}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {page.benefits.map((benefit, index) => {
              const Icon = benefitIcons[index] ?? Sparkles;
              return (
                <Card key={benefit.title}>
                  <CardHeader>
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle>{benefit.title}</CardTitle>
                    <CardDescription>{benefit.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Badge variant="secondary">{page.setupEyebrow}</Badge>
          <h2 className="mt-4 text-3xl font-semibold leading-tight">
            {page.setupTitle}
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            {page.setupText}
          </p>
          <div className="mt-6 rounded-lg border bg-slate-950 p-5 text-sm text-white">
            <p className="text-slate-400">{page.endpointLabel}</p>
            <code className="mt-2 block break-all rounded-md bg-white/10 p-3 text-slate-100">
              {endpoint}
            </code>
            <p className="mt-4 text-slate-400">{page.headerLabel}</p>
            <code className="mt-2 block break-all rounded-md bg-white/10 p-3 text-slate-100">
              Authorization: Bearer air_mcp_...
            </code>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {page.steps.map((step, index) => {
            const Icon = stepIcons[index] ?? CheckCircle2;
            return (
              <Card key={step.title}>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="max-w-3xl">
            <Badge variant="secondary">{page.toolsEyebrow}</Badge>
            <h2 className="mt-4 text-3xl font-semibold">{page.toolsTitle}</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {page.tools.map((tool, index) => {
              const Icon = toolIcons[index] ?? Activity;
              return (
                <Card
                  key={tool.name}
                  className={
                    tool.name === "get_search_traces"
                      ? "border-primary/35 bg-primary/5"
                      : undefined
                  }
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <code className="break-all rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                        {tool.name}
                      </code>
                    </div>
                    <CardDescription className="pt-2">
                      {tool.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Badge variant="secondary">{page.examplesEyebrow}</Badge>
            <h2 className="mt-4 text-3xl font-semibold leading-tight">
              {page.examplesTitle}
            </h2>
          </div>
          <div className="grid gap-3">
            {page.examples.map((example) => (
              <div
                key={example}
                className="flex gap-3 rounded-lg border bg-white p-4"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm leading-6">{example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Badge className="bg-white/10 text-white">
              <ShieldCheck className="mr-2 h-3.5 w-3.5 text-accent" />
              {page.securityEyebrow}
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold">
              {page.securityTitle}
            </h2>
            <p className="mt-4 leading-7 text-slate-300">{page.securityText}</p>
          </div>
          <div className="grid gap-3">
            {page.security.map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-6 rounded-lg border bg-white p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <h2 className="text-3xl font-semibold">{page.finalTitle}</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              {page.finalText}
            </p>
          </div>
          <Button asChild>
            <Link href="/app/settings">
              {page.primaryCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/15 bg-white/10 p-4 backdrop-blur">
      <dt className="text-xs uppercase text-slate-300">{label}</dt>
      <dd className="mt-1 break-all text-lg font-semibold">{value}</dd>
    </div>
  );
}
