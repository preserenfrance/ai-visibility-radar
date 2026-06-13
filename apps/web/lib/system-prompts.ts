import { prisma } from "@ai-radar/db";

export const SYSTEM_PROMPT_KEYS = [
  "website_analysis",
  "prompt_generation",
  "question_blueprint"
] as const;

export type SystemPromptKey = (typeof SYSTEM_PROMPT_KEYS)[number];

export type SystemPromptDefinition = {
  key: SystemPromptKey;
  title: string;
  description: string;
  defaultContent: string;
};

export const SYSTEM_PROMPT_DEFINITIONS: SystemPromptDefinition[] = [
  {
    key: "website_analysis",
    title: "Analiza spletne strani",
    description: "Kako sistem prebere domeno, izbere pomembne strani in razume ponudbo, kupce ter dokazila.",
    defaultContent: [
      "Spletno stran razumi kot kupec, ne kot splošen SEO crawler.",
      "Izlušči konkretno ponudbo: produkte, storitve, glavne funkcionalnosti, idealnega kupca, primere uporabe, nakupne sprožilce, dokazila, geografski trg, jezik in kategorijo.",
      "Prednost daj stranem, ki razlagajo produkt, vrednost, panoge, primere uporabe, reference, cene, integracije, primerjave, podporo in dokazljive rezultate.",
      "Prezri navigacijski šum, piškotke, pravna besedila, generične blog zapise, podvojene elemente postavitve in prazne marketinške fraze.",
      "Če je kontekst strani tanek, oblikuj vprašanja iz domene, imena znamke, konkurentov, države in jezika, vendar ne izmišljaj dejstev."
    ].join("\n")
  },
  {
    key: "prompt_generation",
    title: "Generiranje AI vprašanj",
    description: "Sistemska navodila za vprašanja, ki jih bomo poslali ChatGPT, Gemini in Claude.",
    defaultContent: [
      "Ustvari vprašanja, ki bi jih realen kupec zastavil pred izbiro produkta, rešitve, storitve, agencije, orodja ali strokovnjaka.",
      "Vprašanja naj bodo praktična, kupčeva in produktno naravnana: izbor, primerjava, funkcionalnosti, cena, podpora, dokazila, uvedba, omejitve in alternative.",
      "Večina vprašanj naj bo slepih discovery, primerjalnih, problemskih, lokalnih ali best-fit vprašanj in naj ne omenja merjene znamke.",
      "Vključi samo malo branded vprašanj, da preverimo, ali AI pravilno razloži merjeno znamko.",
      "Vsako vprašanje mora biti dovolj konkretno, da razkrije konkurente, citacije, rangiranje in nakupni namen.",
      "Izogibaj se vanity vprašanjem, generičnim SEO ključnim besedam, internemu žargonu podjetja in vprašanjem, kjer je merjena znamka očitno vsiljena v odgovor.",
      "Če je jezik sl ali slovenščina, morajo biti vprašanja v lepi, naravni slovenščini s pravilnimi znaki č, š in ž."
    ].join("\n")
  },
  {
    key: "question_blueprint",
    title: "Predloge testnih vprašanj",
    description: "Ena predloga na vrstico. Spremenljivke: {brandName}, {industry}, {country}, {localMarket}, {language}, {competitors}.",
    defaultContent: [
      "Katere produkte ali rešitve naj preveri podjetje v {localMarket}, če išče rešitev za področje \"{industry}\"?",
      "Katere rešitve bi priporočil podjetju, ki potrebuje praktično pomoč na področju \"{industry}\"?",
      "Kako naj kupec primerja ponudnike za področje \"{industry}\" glede funkcionalnosti, cene, podpore in dokazil?",
      "Kateri ponudniki za področje \"{industry}\" imajo najbolj jasne reference, primere uporabe in dokazljive rezultate?",
      "Katere so najboljše alternative za {competitors}?",
      "Ali je {brandName} verodostojen ponudnik za področje \"{industry}\"?",
      "Kaj mora podjetje vprašati ponudnika za področje \"{industry}\", preden izbere produkt ali rešitev?"
    ].join("\n")
  }
];

export function systemPromptDefinition(key: SystemPromptKey) {
  const definition = SYSTEM_PROMPT_DEFINITIONS.find((item) => item.key === key);
  if (!definition) throw new Error(`Unknown system prompt key: ${key}`);
  return definition;
}

export function isSystemPromptKey(value: string): value is SystemPromptKey {
  return SYSTEM_PROMPT_KEYS.includes(value as SystemPromptKey);
}

export async function systemPromptContent(key: SystemPromptKey) {
  const definition = systemPromptDefinition(key);
  const saved = await prisma.systemPrompt.findUnique({ where: { key } }).catch(() => null);
  return saved?.content ?? definition.defaultContent;
}

export async function systemPromptSettings() {
  const savedPrompts = await prisma.systemPrompt
    .findMany({
      where: { key: { in: [...SYSTEM_PROMPT_KEYS] } }
    })
    .catch(() => []);
  const savedByKey = new Map(savedPrompts.map((prompt) => [prompt.key, prompt]));

  return SYSTEM_PROMPT_DEFINITIONS.map((definition) => {
    const saved = savedByKey.get(definition.key);
    return {
      ...definition,
      content: saved?.content ?? definition.defaultContent,
      updatedAt: saved?.updatedAt,
      updatedByEmail: saved?.updatedByEmail
    };
  });
}

export async function saveSystemPrompt(input: {
  key: SystemPromptKey;
  content: string;
  updatedByEmail?: string;
}) {
  const definition = systemPromptDefinition(input.key);
  return prisma.systemPrompt.upsert({
    where: { key: input.key },
    update: {
      title: definition.title,
      description: definition.description,
      content: input.content,
      defaultContent: definition.defaultContent,
      updatedByEmail: input.updatedByEmail
    },
    create: {
      key: input.key,
      title: definition.title,
      description: definition.description,
      content: input.content,
      defaultContent: definition.defaultContent,
      updatedByEmail: input.updatedByEmail
    }
  });
}

export async function resetSystemPrompt(key: SystemPromptKey, updatedByEmail?: string) {
  const definition = systemPromptDefinition(key);
  return saveSystemPrompt({
    key,
    content: definition.defaultContent,
    updatedByEmail
  });
}
