import { prisma } from "@ai-radar/db";

const FAQ_SETTINGS_KEY = "faq_content";

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
          "Uporabnik vnese znamko, spletno stran, konkurente in prompte. Radar nato te prompte pošlje izbranim AI modelom, shrani odgovore, preveri omembe znamke in konkurentov, izračuna metrike ter prikaže, kje je znamka dobro vidna in kje izgublja priložnosti.",
      },
      {
        question: "Kaj je prompt?",
        answer:
          "Prompt je vprašanje, ki ga kupec postavi AI pomočniku. Dober prompt je konkreten in nakupno usmerjen, na primer: Kje lahko kupim kakovostno vrtno pohištvo z dostavo v Sloveniji?",
      },
      {
        question: "Ali moram vnašati vseh 10 promptov?",
        answer:
          "Ne. Za prvi audit moraš vnesti vsaj 3 prompte, lahko pa jih vneseš do 10. Pri znamki lahko kasneje dodaš več promptov, vsak prompt v svojo vrstico. Brezplačni paket je omejen na 10 aktivnih promptov na znamko.",
      },
    ],
  },
  {
    title: "Modeli in scani",
    items: [
      {
        question: "Katere AI modele uporabljate?",
        answer:
          "Orodje podpira ChatGPT, Gemini, Claude ter search različice modelov, kjer se zbirajo tudi viri oziroma citati. Vsi pogledi so dostopni v vseh paketih; paketi se razlikujejo po številu promptov in zagonih.",
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
          "Reden scan samodejno ponavlja meritev za tvojo znamko. Avtomatski dnevni zagon je vključen v Growth paket; Starter je namenjen ročnim zagonom.",
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
          "Brezplačni paket omogoča eno znamko in do 10 aktivnih promptov. Starter paket stane 15,99 EUR na mesec in vključuje več promptov ter ročne zagone. Growth paket stane 39,99 EUR na mesec in vključuje dodatne znamke, več promptov ter dnevni avtomatski zagon.",
      },
      {
        question: "Kaj dobim v brezplačnem paketu?",
        answer:
          "Brezplačni paket vključuje eno znamko, do 10 aktivnih promptov ter dostop do vseh zavihkov in prikazov. Ročni in avtomatski zagoni promptov so del plačljivih paketov.",
      },
      {
        question: "Kdaj potrebujem plačljiv paket?",
        answer:
          "Plačljiv paket potrebuješ, ko želiš več aktivnih promptov ali ročno oziroma avtomatsko zaganjanje meritev. Starter je za ročno delo, Growth pa za več znamk in avtomatsko spremljanje.",
      },
      {
        question: "Ali lahko paket kasneje spremenim?",
        answer:
          "Da. V nastavitvah lahko odpreš plačilni portal in upravljaš naročnino. Če naročnina ni aktivna, se plačljivi zagoni promptov in avtomatski scani ne izvajajo.",
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

export async function faqSections() {
  const saved = await prisma.systemPrompt
    .findUnique({ where: { key: FAQ_SETTINGS_KEY } })
    .catch(() => null);
  if (!saved?.content) return DEFAULT_FAQ_SECTIONS;
  return parseFaqSections(saved.content);
}

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
