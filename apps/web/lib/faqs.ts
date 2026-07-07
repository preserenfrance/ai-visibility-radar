import { unstable_cache } from "next/cache";
import { prisma } from "@ai-radar/db";

const FAQ_SETTINGS_KEY = "faq_content";
export const FAQ_CACHE_TAG = "public-faq";

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqSection = {
  title: string;
  items: FaqItem[];
};

export const DEFAULT_FAQ_SECTIONS: FaqSection[] = [
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
          "Uporabnik vnese znamko, spletno stran, konkurente in vprašanja kupcev. Radar nato ta vprašanja pošlje izbranim AI modelom, shrani odgovore, preveri omembe znamke in konkurentov, izračuna metrike ter prikaže, kje je znamka dobro vidna in kje izgublja priložnosti.",
      },
      {
        question: "Kaj je vprašanje oziroma prompt?",
        answer:
          "Prompt je vprašanje, ki ga kupec postavi AI pomočniku. Dobro vprašanje je konkretno in nakupno usmerjeno, na primer: Kje lahko kupim kakovostno vrtno pohištvo z dostavo v Sloveniji?",
      },
      {
        question: "Ali moram vnašati vseh 5 vprašanj v prvem pregledu?",
        answer:
          "Ne. Za prvi brezplačni pregled moraš vnesti vsaj 3 vprašanja, lahko pa jih vneseš do 5. Ko si v aplikaciji ustvariš znamko, lahko v brezplačnem paketu uporabljaš do 10 aktivnih vprašanj oziroma promptov na znamko, plačljivi paketi pa imajo višje limite.",
      },
    ],
  },
  {
    title: "Modeli in pregledi",
    items: [
      {
        question: "Katere AI modele uporabljate?",
        answer:
          "Orodje podpira ChatGPT, Gemini, Claude ter modele z iskanjem, kjer se zbirajo tudi viri oziroma citati. Vsi pogledi so dostopni v vseh paketih; paketi se razlikujejo po številu aktivnih vprašanj in ročnih pregledih.",
      },
      {
        question:
          "Kakšna je razlika med navadnimi modeli in modeli z iskanjem?",
        answer:
          "Navadni modeli odgovorijo iz svojega modelskega znanja. Modeli z iskanjem ob odgovoru iščejo po spletu in pogosto vrnejo vire, zato lahko vidiš, katere domene AI uporablja kot dokaz ali priporočilo.",
      },
      {
        question: "Kaj pomeni reden pregled?",
        answer:
          "Reden pregled samodejno ponavlja meritev za tvojo znamko. Avtomatski tedenski pregled je vključen v vseh paketih, tudi v brezplačnem.",
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
          "Citati so viri, ki jih modeli z iskanjem uporabijo pri odgovoru. V tabeli citatov vidiš, katere domene podpirajo tvojo znamko, katere podpirajo konkurente in katere vire bi bilo smiselno okrepiti.",
      },
      {
        question: "Kaj pomeni ChatGPT pogled na znamko?",
        answer:
          "To je kratek AI povzetek javne slike znamke. Prikaže, kako ChatGPT razume znamko, kateri produkti ali storitve so najbolj izpostavljeni in katere javne pripombe ali zadržki se lahko ponavljajo pri nezadovoljnih strankah.",
      },
    ],
  },
  {
    title: "Paketi in cene",
    items: [
      {
        question: "Koliko stane orodje?",
        answer:
          "Brezplačni paket omogoča eno znamko, do 10 aktivnih vprašanj in tedenski avtomatski pregled. Starter paket stane 15,99 EUR na mesec in vključuje več vprašanj ter 4 ročne preglede na mesec. Growth paket stane 39,99 EUR na mesec in vključuje dodatne znamke, več vprašanj ter 15 ročnih pregledov na mesec.",
      },
      {
        question: "Kaj dobim v brezplačnem paketu?",
        answer:
          "Brezplačni paket vključuje eno znamko, do 10 aktivnih vprašanj, tedenski avtomatski pregled ter dostop do vseh zavihkov in prikazov. Ročni pregledi so del plačljivih paketov.",
      },
      {
        question: "Kdaj potrebujem plačljiv paket?",
        answer:
          "Plačljiv paket potrebuješ, ko želiš več aktivnih vprašanj ali ročno zaganjanje meritev. Starter je za eno znamko, Growth pa za več znamk in višje limite.",
      },
      {
        question: "Ali lahko paket kasneje spremenim?",
        answer:
          "Da. V nastavitvah lahko odpreš plačilni portal in upravljaš naročnino. Če naročnina ni aktivna, se organizacija vrne na brezplačne limite; ročni pregledi plačljivih paketov takrat niso na voljo.",
      },
    ],
  },
  {
    title: "Praktična uporaba",
    items: [
      {
        question: "Kakšna vprašanja naj vnesem?",
        answer:
          "Najboljša so konkretna vprašanja kupcev: kaj kupiti, kje kupiti, kateri ponudnik je dobra izbira, katera trgovina ima določen produkt, kateri izdelek je primeren za določen problem. Manj uporabna so vprašanja, ki že vsebujejo tvojo znamko, ker takrat meritev ni realna.",
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
          "Ne. AI odgovori se spreminjajo glede na model, čas, vprašanje in dostopne vire. Radar zato meri ponovljive vzorce in trende, ne absolutne garancije. Prava vrednost je v rednem spremljanju in izboljševanju signalov, ki jih modeli uporabljajo.",
      },
    ],
  },
];

export async function faqSections() {
  if (!process.env.DATABASE_URL) return DEFAULT_FAQ_SECTIONS;

  const saved = await prisma.systemPrompt
    .findUnique({ where: { key: FAQ_SETTINGS_KEY } })
    .catch(() => null);
  if (!saved?.content) return DEFAULT_FAQ_SECTIONS;
  return parseFaqSections(saved.content);
}

export const cachedFaqSections = unstable_cache(
  faqSections,
  ["public-faq-sections"],
  {
    revalidate: 300,
    tags: [FAQ_CACHE_TAG],
  },
);

export async function saveFaqSections(
  sections: FaqSection[],
  updatedByEmail?: string,
) {
  const content = JSON.stringify(normalizeFaqSections(sections), null, 2);
  return prisma.systemPrompt.upsert({
    where: { key: FAQ_SETTINGS_KEY },
    update: {
      title: "FAQ vsebina",
      description: "Urejljiva vsebina javne FAQ strani.",
      content,
      defaultContent: JSON.stringify(DEFAULT_FAQ_SECTIONS, null, 2),
      updatedByEmail,
    },
    create: {
      key: FAQ_SETTINGS_KEY,
      title: "FAQ vsebina",
      description: "Urejljiva vsebina javne FAQ strani.",
      content,
      defaultContent: JSON.stringify(DEFAULT_FAQ_SECTIONS, null, 2),
      updatedByEmail,
    },
  });
}

export async function resetFaqSections(updatedByEmail?: string) {
  return saveFaqSections(DEFAULT_FAQ_SECTIONS, updatedByEmail);
}

function parseFaqSections(content: string): FaqSection[] {
  try {
    return normalizeFaqSections(JSON.parse(content));
  } catch {
    return DEFAULT_FAQ_SECTIONS;
  }
}

export function normalizeFaqSections(value: unknown): FaqSection[] {
  if (!Array.isArray(value)) return DEFAULT_FAQ_SECTIONS;
  const sections = value
    .map((section) => {
      const candidate = section as { title?: unknown; items?: unknown };
      const title =
        typeof candidate.title === "string" ? candidate.title.trim() : "";
      const items = Array.isArray(candidate.items)
        ? candidate.items
            .map((item) => {
              const itemCandidate = item as {
                question?: unknown;
                answer?: unknown;
              };
              return {
                question:
                  typeof itemCandidate.question === "string"
                    ? itemCandidate.question.trim()
                    : "",
                answer:
                  typeof itemCandidate.answer === "string"
                    ? itemCandidate.answer.trim()
                    : "",
              };
            })
            .filter((item) => item.question && item.answer)
        : [];

      return { title, items };
    })
    .filter((section) => section.title && section.items.length > 0);

  return sections.length ? sections : DEFAULT_FAQ_SECTIONS;
}
