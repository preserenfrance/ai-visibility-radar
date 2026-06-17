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
  TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features: Array<{
  title: string;
  description: string;
  Icon: typeof Activity;
}> = [
  {
    title: "Meritev omemb",
    description: "Preveri, ali se tvoja znamka pojavi v odgovorih ChatGPT, Gemini in Claude.",
    Icon: Activity
  },
  {
    title: "Rang med konkurenti",
    description: "Radar pokaže, kdo je v AI odgovorih pred tabo in pri katerih vprašanjih izgubljaš vidnost.",
    Icon: Target
  },
  {
    title: "Citirani viri",
    description: "Vidiš, katere strani AI modeli navajajo kot dokaz in kje moraš okrepiti avtoriteto.",
    Icon: BadgeCheck
  },
  {
    title: "Sentiment odgovorov",
    description: "Ni dovolj, da si omenjen. Pomembno je tudi, ali te modeli predstavijo kot dobro izbiro.",
    Icon: Sparkles
  },
  {
    title: "Naloge za izboljšave",
    description: "Vsak audit se zaključi s konkretnimi SEO, vsebinskimi in citacijskimi priporočili.",
    Icon: ClipboardList
  },
  {
    title: "Varen dostop",
    description: "Prijava, organizacije in admin dostop so ločeni, zato uporabniki vidijo samo svoje podatke.",
    Icon: ShieldCheck
  }
];

const steps = [
  {
    title: "Vneseš 5 promptov",
    description: "Sam določiš vprašanja, ki jih želiš meriti za svojo znamko, trg in konkurente."
  },
  {
    title: "Modeli dobijo tvoja vprašanja",
    description: "Radar ista vprašanja pošlje izbranim AI modelom, zato meriš natanko tiste scenarije, ki so pomembni zate."
  },
  {
    title: "Dobiš rezultat in prioritete",
    description: "Poročilo pokaže score, omembe, rang, citacije, šibke točke in naslednje korake."
  }
];

const useCases = [
  "SEO ekipe, ki želijo meriti AI vidnost poleg klasičnih pozicij v Googlu.",
  "B2B podjetja, kjer se kupci pred kontaktom informirajo v ChatGPT ali Gemini.",
  "Agencije, ki želijo strankam pokazati jasen dokaz, zakaj je treba urediti vsebino in avtoriteto.",
  "Vodstva, ki potrebujejo preprost score in seznam prioritet brez branja tehničnih logov."
];

const reviews = [
  {
    name: "Maja, vodja marketinga",
    company: "B2B SaaS ekipa",
    text: "Končno smo videli, zakaj nas AI priporoča pri nekaterih vprašanjih, pri drugih pa sploh ne. Najbolj uporabni so bili konkretni naslednji koraki.",
    rating: 5
  },
  {
    name: "Tomaž, SEO svetovalec",
    company: "Digitalna agencija",
    text: "Audit je dober pogovor s stranko odprl v petih minutah. Score, konkurenti in citirani viri so precej bolj razumljivi kot surov seznam promptov.",
    rating: 5
  },
  {
    name: "Nina, ustanoviteljica",
    company: "Storitveno podjetje",
    text: "Najprej sem mislila, da gre samo za še eno poročilo. Potem sem videla, kateri konkurenti se ponavljajo v odgovorih, in takoj vedela, kaj moramo popraviti.",
    rating: 5
  }
];

const metrics = [
  { label: "AI Visibility Score", value: "0-100" },
  { label: "Testni prompti", value: "5" },
  { label: "Primerjava modelov", value: "3 AI" },
  { label: "Poročilo", value: "takoj" }
];

export default function HomePage() {
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
                Brezplačen AI audit vidnosti
              </p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
                Preveri, ali te ChatGPT, Gemini in Claude priporočajo.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">
                AI Visibility Radar izmeri, kako pogosto se tvoja znamka pojavi v AI odgovorih,
                kateri konkurenti te prehitevajo, katere vire modeli citirajo in kaj moraš
                popraviti, da boš pogosteje priporočena izbira.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="default">
                  <Link href="/ai-visibility-checker">
                    Zaženi brezplačen audit <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/40 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/login">Odpri aplikacijo</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div>
                  <p className="text-sm text-slate-300">Primer audita</p>
                  <h2 className="mt-1 text-2xl font-semibold">Vidnost znamke</h2>
                </div>
                <Badge className="bg-accent/20 text-amber-100">v živo</Badge>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-md border border-white/15 bg-slate-950/45 p-4">
                    <div className="text-2xl font-semibold">{metric.value}</div>
                    <div className="mt-1 text-sm text-slate-300">{metric.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3 text-sm text-slate-200">
                <HeroCheck>Omembe znamke v AI odgovorih</HeroCheck>
                <HeroCheck>Primerjava z najbližjimi konkurenti</HeroCheck>
                <HeroCheck>Seznam citiranih virov in vsebinskih vrzeli</HeroCheck>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Badge variant="secondary">Kaj meri</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal">
              AI vidnost je nova plast iskanja. Radar jo naredi merljivo.
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Kupci vedno pogosteje vprašajo AI model, katero podjetje izbrati, katero rešitev
              primerjati ali komu lahko zaupajo. Če te model ne pozna, ne citira ali te predstavi
              slabše od konkurence, izgubljaš povpraševanja, še preden pridejo do tvoje strani.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="max-w-2xl">
          <Badge variant="secondary">Kako deluje</Badge>
          <h2 className="mt-4 text-3xl font-semibold">Od tvojih promptov do jasnega načrta izboljšav.</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Audit je narejen tako, da ga razume marketing, prodaja in vodstvo. Ne dobiš samo številke,
            ampak razlago, zakaj je rezultat takšen in kje je najhitrejši napredek.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
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
            <Badge className="bg-white/10 text-white">Primer rezultatov</Badge>
            <h2 className="mt-4 text-3xl font-semibold">Vidiš ne samo, če si omenjen, ampak zakaj.</h2>
            <p className="mt-4 leading-7 text-slate-300">
              Poročilo poveže prompt, odgovor modela, rang znamke, citacije, sentiment in konkurente.
              Tako hitro ločiš med težavo v vsebini, avtoriteti vira, pozicioniranju ali jasnosti ponudbe.
            </p>
            <div className="mt-6 grid gap-3">
              <DarkCheck>Prompti po fazah nakupne poti</DarkCheck>
              <DarkCheck>Top konkurenti, ki se ponavljajo v odgovorih</DarkCheck>
              <DarkCheck>Viri, ki jih modeli uporabljajo kot dokaz</DarkCheck>
              <DarkCheck>Prednostne naloge za SEO in vsebino</DarkCheck>
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-5">
            <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-4">
              <div>
                <p className="text-sm text-slate-300">AI Visibility Score</p>
                <div className="mt-1 text-5xl font-semibold">72<span className="text-2xl text-slate-300">/100</span></div>
              </div>
              <TrendingUp className="h-10 w-10 text-accent" />
            </div>
            <div className="mt-5 grid gap-3">
              <ScoreRow label="Omembe znamke" value="8 od 12 promptov" />
              <ScoreRow label="Povprečni rang" value="2. mesto" />
              <ScoreRow label="Najmočnejši vir" value="strokovni vodič" />
              <ScoreRow label="Največja vrzel" value="primerjalna vsebina" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Badge variant="secondary">Za koga je</Badge>
          <h2 className="mt-4 text-3xl font-semibold">Za ekipe, ki želijo vedeti, kaj AI modeli povedo o njih.</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Radar je uporaben za podjetja, ki že vlagajo v SEO, vsebino, PR ali prodajo in želijo preveriti,
            ali se ta trud pozna tudi v odgovorih generativnih iskalnikov.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/ai-visibility-checker">Preveri svoje prompte</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">Poglej cenik</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          {useCases.map((item) => (
            <div key={item} className="flex gap-3 rounded-lg border bg-white p-4">
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
              <Badge variant="secondary">Reviewi</Badge>
              <h2 className="mt-4 text-3xl font-semibold">Mnenja uporabnikov in ekip, ki spremljajo AI vidnost.</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Na prvo stran lahko dodamo tudi tvoje realne reviewe. Razdelek je pripravljen tako, da podpira
                kratke citate, oceno in opis podjetja.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="mailto:info@ai-visibility-radar.si?subject=Review%20za%20AI%20Visibility%20Radar">
                Dodaj review
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <Card key={review.name}>
                <CardHeader>
                  <div className="mb-3 flex gap-1 text-accent" aria-label={`${review.rating} od 5 zvezdic`}>
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
                  <div className="text-sm text-muted-foreground">{review.company}</div>
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
              Prvi audit je brezplačen
            </div>
            <h2 className="text-3xl font-semibold">Poglej, kako te AI modeli vidijo danes.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-300">
              Vnesi domeno in 5 promptov, prejmi osnovni AI Visibility Score in odkrij, katere vsebine, citacije
              in primerjave najprej izboljšati.
            </p>
          </div>
          <Button asChild size="default" className="bg-white text-slate-950 hover:bg-slate-200">
            <Link href="/ai-visibility-checker">
              Zaženi audit <ArrowRight className="h-4 w-4" />
            </Link>
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
