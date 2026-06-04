import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, BadgeCheck, Radar, SearchCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features: Array<{
  title: string;
  description: string;
  Icon: typeof Activity;
}> = [
  { title: "Raw answers", description: "Vsak AI odgovor se shrani loceno od parser rezultata.", Icon: Activity },
  { title: "Citations", description: "OpenAI, Gemini in Claude citacije se normalizirajo v isto tabelo.", Icon: BadgeCheck },
  { title: "Tenant checks", description: "API poti preverijo clanstvo pred dostopom do brandov in scanov.", Icon: ShieldCheck }
];

export default function HomePage() {
  return (
    <main>
      <section className="relative min-h-[92vh] overflow-hidden bg-slate-950 text-white">
        <Image
          src="/images/ai-visibility-radar-hero.png"
          alt="AI Visibility Radar dashboard on a laptop"
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/10" />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col px-5 py-5">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
              <Radar className="h-5 w-5 text-accent" />
              AI Visibility Radar
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="text-white hover:bg-white/10">
                <Link href="/pricing">Pricing</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/onboarding">Sign in</Link>
              </Button>
            </div>
          </nav>
          <div className="flex flex-1 items-center py-12">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-sm bg-white/10 px-3 py-1 text-sm">
                <SearchCheck className="h-4 w-4 text-accent" />
                Official APIs only
              </p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
                Preveri, ali te ChatGPT, Gemini in Claude priporocajo.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">
                Vnesi domeno in dobi ponovljivo meritev testnih promptov: omembe, rang, konkurente,
                citirane vire, sentiment in konkretne naloge za izboljsanje.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="default">
                  <Link href="/ai-visibility-checker">
                    Zazeni brezplacen audit <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/40 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/app/onboarding">Odpri aplikacijo</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-12 md:grid-cols-3">
        {features.map(({ title, description, Icon }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" /> {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
