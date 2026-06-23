import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pogosta vprašanja | AI Visibility Radar",
  description:
    "Odgovori na najpogostejša vprašanja o AI Visibility Radarju, modelih, cenah, metrikah in rednih scanih.",
};

const faqSections = [
  {
    title: "Osnove",
    items: [
      {
        question: "Čemu je namenjen AI Visibility Radar?",
        answer:
          "Namenjen je podjetjem, ki želijo vedeti, ali jih AI pomočniki, kot so ChatGPT, Gemini in Claude, omenijo oziroma priporočijo pri vprašanjih, ki jih potencialni kupci dejansko postavljajo. Namesto da merimo samo pozicije v Googlu, merimo vidnost znamke v AI odgovorih.",
      },
      {
        question: "Kako orodje deluje?",
        answer:
          "Uporabnik vnese znamko, spletno stran, konkurente in prompte. Radar nato te prompte pošlje izbranim AI modelom, shrani odgovore, preveri omembe znamke in konkurentov, izračuna metrike ter prikaže, kje je znamka dobro vidna in kje izgublja priložnosti.",
      },
      {
        question: "Kaj je prompt?",
        answer:
          "Prompt je vprašanje, ki ga kupec postavi AI pomočniku. Dober prompt je konkreten in nakupno usmerjen, na primer: Kje lahko kupim kakovostno vrtno pohištvo z dostavo v Sloveniji?",
      },
      {
        question: "Ali moram vnašati vseh 5 promptov?",
        answer:
          "Za prvi audit moraš vnesti vsaj 3 prompte. Pri znamki lahko kasneje dodaš več promptov, vsak prompt v svojo vrstico. Brezplačni paket je omejen na 10 aktivnih promptov na znamko.",
      },
    ],
  },
  {
    title: "Modeli in scani",
    items: [
      {
        question: "Katere AI modele uporabljate?",
        answer:
          "Osnovni pregled uporablja ChatGPT. Plačljivi paketi omogočajo tudi Gemini, Claude ter search različice modelov: ChatGPT Search, Gemini Search in Claude Search, kjer se zbirajo tudi viri oziroma citati.",
      },
      {
        question:
          "Kakšna je razlika med navadnimi modeli in modeli s searchom?",
        answer:
          "Navadni modeli odgovorijo iz svojega modelskega znanja. Search modeli ob odgovoru iščejo po spletu in pogosto vrnejo vire, zato lahko vidiš, katere domene AI uporablja kot dokaz ali priporočilo.",
      },
      {
        question: "Kaj pomeni reden scan?",
        answer:
          "Reden scan samodejno ponavlja meritev za tvojo znamko. Starter paket podpira tedenski reden scan, Growth paket pa dnevni reden scan. Redni scani so na voljo samo ob aktivni plačljivi naročnini.",
      },
      {
        question: "Zakaj rezultati med modeli niso enaki?",
        answer:
          "Vsak model ima drugačen način odgovarjanja, drugačen dostop do svežih informacij in drugačno razumevanje trga. Zato je pomembno spremljati več modelov, če želiš razumeti realno AI vidnost znamke.",
      },
    ],
  },
  {
    title: "Metrike in rezultati",
    items: [
      {
        question: "Kaj pomeni vidnost?",
        answer:
          "Vidnost je skupna ocena AI prisotnosti znamke. Združuje omembe, rang, citate, delež glasu in točnost. Višja ocena pomeni, da se znamka pogosteje in bolje pojavlja v AI odgovorih.",
      },
      {
        question: "Kaj pomenijo omembe?",
        answer:
          "Omembe povedo, kako pogosto AI modeli v odgovorih sploh omenijo tvojo znamko. Če znamka ni omenjena, kupec prek AI odgovora verjetno ne pride do tebe.",
      },
      {
        question: "Kaj je delež glasu?",
        answer:
          "Delež glasu primerja omembe tvoje znamke z omembami konkurentov. Pomaga razumeti, ali AI modeli pogosteje priporočajo tebe ali druge ponudnike.",
      },
      {
        question: "Kaj pomeni točnost?",
        answer:
          "Točnost meri, ali so navedbe o tvoji znamki pravilne in zanesljive. Ni dovolj, da si omenjen, pomembno je tudi, da AI o tebi ne navaja napačnih ali zastarelih informacij.",
      },
      {
        question: "Kaj so citati?",
        answer:
          "Citati so viri, ki jih search modeli uporabijo pri odgovoru. V tabeli citatov vidiš, katere domene podpirajo tvojo znamko, katere podpirajo konkurente in katere vire bi bilo smiselno okrepiti.",
      },
    ],
  },
  {
    title: "Paketi in cene",
    items: [
      {
        question: "Koliko stane orodje?",
        answer:
          "Brezplačni paket omogoča začetni pregled. Starter paket stane 15,99 € na mesec in vključuje več promptov, dodatne modele, citate, konkurente in tedenski reden scan. Growth paket stane 39,99 € na mesec in je namenjen pogostejšemu spremljanju z dnevnim rednim scanom.",
      },
      {
        question: "Kaj dobim v brezplačnem paketu?",
        answer:
          "Brezplačni paket vključuje eno znamko, do 10 aktivnih promptov in osnovni pregled v ChatGPT. Namenjen je prvemu občutku, ali te AI sploh omenja.",
      },
      {
        question: "Kdaj potrebujem plačljiv paket?",
        answer:
          "Plačljiv paket je smiseln, ko želiš spremljati več modelov, konkurente, citate, ideje za izboljšanje in redne scane. To je pomembno, če želiš AI vidnost izboljševati sistematično, ne samo enkrat preveriti.",
      },
      {
        question: "Ali lahko paket kasneje spremenim?",
        answer:
          "Da. V nastavitvah lahko odpreš plačilni portal in upravljaš naročnino. Če naročnina ni aktivna, se plačljive funkcije in redni scani ne izvajajo.",
      },
    ],
  },
  {
    title: "Praktična uporaba",
    items: [
      {
        question: "Kakšne prompte naj vnesem?",
        answer:
          "Najboljši prompti so konkretna vprašanja kupcev: kaj kupiti, kje kupiti, kateri ponudnik je dobra izbira, katera trgovina ima določen produkt, kateri izdelek je primeren za določen problem. Manj uporabni so prompti, ki že vsebujejo tvojo znamko, ker takrat meritev ni realna.",
      },
      {
        question: "Kaj naredim, če me AI ne omeni?",
        answer:
          "Najprej poglej, kateri konkurenti so omenjeni in kateri viri so citirani. Nato izboljšaj vsebine na strani, dodaj jasne produktne informacije, primerjalne strani, kategorijske vodiče, dokazila, ocene, FAQ vsebine in vire, ki jih AI lahko razume ter citira.",
      },
      {
        question: "Ali orodje samo popravi mojo spletno stran?",
        answer:
          "Ne. Orodje pokaže, kje izgubljaš vidnost in kaj je smiselno izboljšati. Izvedba sprememb na spletni strani, vsebinah, kategorijah in zunanjih virih ostane pri tebi oziroma tvoji ekipi.",
      },
      {
        question: "Komu je orodje najbolj koristno?",
        answer:
          "Najbolj koristno je spletnim trgovinam, B2B podjetjem, lokalnim ponudnikom, SaaS podjetjem in vsem, kjer se kupci pred nakupom informirajo prek AI pomočnikov.",
      },
      {
        question: "Ali so rezultati zagotovilo, da me bo AI vedno priporočil?",
        answer:
          "Ne. AI odgovori se spreminjajo glede na model, čas, prompt in dostopne vire. Radar zato meri ponovljive vzorce in trende, ne absolutne garancije. Prava vrednost je v rednem spremljanju in izboljševanju signalov, ki jih modeli uporabljajo.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <HelpCircle className="h-4 w-4" />
            Pogosta vprašanja
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight">
            Kako deluje AI Visibility Radar?
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Kratki odgovori za podjetja, ki razmišljajo o uporabi, in za
            uporabnike, ki želijo bolje razumeti rezultate, modele, cene in
            redne scane.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/pricing">Poglej cenik</Link>
          </Button>
          <Button asChild>
            <Link href="/ai-visibility-checker">
              Začni audit <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5">
        {faqSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {section.items.map((item) => (
                <details
                  key={item.question}
                  className="rounded-md border bg-secondary/20 p-4"
                >
                  <summary className="cursor-pointer font-medium">
                    {item.question}
                  </summary>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
