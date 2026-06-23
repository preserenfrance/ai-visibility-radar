import { prisma } from "@ai-radar/db";

export const SYSTEM_PROMPT_KEYS = [
  "website_analysis",
  "prompt_generation",
  "question_blueprint",
  "prompt_suggestion",
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
    title: "Legacy analiza spletne strani",
    description:
      "Izklopljeno. Sistem ne analizira več spletne strani; uporablja samo uporabniško vnesene prompte.",
    defaultContent: [
      "Izklopljeno: spletne strani se ne crawla in ne analizira.",
      "Uporabnik na začetku vnese vsaj 3 in največ 10 promptov; ti prompti se uporabijo za prvi audit, ročne scane in redne scane.",
    ].join("\n"),
  },
  {
    key: "prompt_generation",
    title: "Legacy generiranje AI vprašanj",
    description: "Izklopljeno. Promptov ne generiramo več samodejno.",
    defaultContent: [
      "Izklopljeno: sistem ne piše promptov.",
      "Aktivni prompt set nastane iz 3-10 promptov, ki jih uporabnik vnese v začetnem obrazcu.",
    ].join("\n"),
  },
  {
    key: "question_blueprint",
    title: "Legacy predloge testnih vprašanj",
    description:
      "Izklopljeno. Predloge se ne uporabljajo več za generiranje promptov.",
    defaultContent: [
      "Izklopljeno: uporabnik vnese točna vprašanja, ki jih želi meriti.",
    ].join("\n"),
  },
  {
    key: "prompt_suggestion",
    title: "Predlaganje promptov v začetnem auditu",
    description:
      "Navodilo za gumb 'Vi mi predlagajte prompte' na začetnem audit obrazcu.",
    defaultContent: [
      "Ustvari točno 5 kratkih vprašanj, ki jih lahko uporabnik uporabi za AI visibility audit.",
      "Najprej preglej spletno stran in razumi, katere konkretne produkte, kategorije in namene nakupa trgovina ponuja.",
      "Vsaj 4 od 5 vprašanj naj bodo produktna vprašanja tipa: kje kupiti, kateri izdelek izbrati, katera spletna trgovina ima dobro ponudbo, kaj priporočate za konkreten namen.",
      "Vprašanja naj zvenijo kot resnično vprašanje kupca, ki išče izdelek ali trgovino, ne kot vprašanje marketinškega analitika.",
      "Ne omenjaj testirane znamke v promptih.",
      "Ne omenjaj konkurentov ali drugih brandov, razen če je uporabnik izrecno vnesel konkurente in je primerjava res nujna.",
      "Največ eno vprašanje je lahko primerjava; ostala naj bodo usmerjena v produkte, kategorije, uporabo, nakup in izbiro trgovine.",
      "Uporabi konkretne produktne kategorije s spletne strani. Za vrtno trgovino bi to lahko bili na primer vrtni stoli, vrtne mize, senčniki, visoke grede, vrtne garniture, žari ali orodje.",
      "Vsak prompt naj bo ena sama poved, kratek in konkreten.",
      "Vsi prompti naj bodo v jeziku, ki ga uporabnik zahteva.",
    ].join("\n"),
  },
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
  const saved = await prisma.systemPrompt
    .findUnique({ where: { key } })
    .catch(() => null);
  return saved?.content ?? definition.defaultContent;
}

export async function systemPromptSettings() {
  const savedPrompts = await prisma.systemPrompt
    .findMany({
      where: { key: { in: [...SYSTEM_PROMPT_KEYS] } },
    })
    .catch(() => []);
  const savedByKey = new Map(
    savedPrompts.map((prompt) => [prompt.key, prompt]),
  );

  return SYSTEM_PROMPT_DEFINITIONS.map((definition) => {
    const saved = savedByKey.get(definition.key);
    return {
      ...definition,
      content: saved?.content ?? definition.defaultContent,
      updatedAt: saved?.updatedAt,
      updatedByEmail: saved?.updatedByEmail,
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
      updatedByEmail: input.updatedByEmail,
    },
    create: {
      key: input.key,
      title: definition.title,
      description: definition.description,
      content: input.content,
      defaultContent: definition.defaultContent,
      updatedByEmail: input.updatedByEmail,
    },
  });
}

export async function resetSystemPrompt(
  key: SystemPromptKey,
  updatedByEmail?: string,
) {
  const definition = systemPromptDefinition(key);
  return saveSystemPrompt({
    key,
    content: definition.defaultContent,
    updatedByEmail,
  });
}
