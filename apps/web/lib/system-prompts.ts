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
      "Understand the website as a buyer would, not as a generic SEO crawler.",
      "Extract the concrete offer, ideal customer profile, use cases, buying triggers, proof points, geography, language, and category.",
      "Prefer pages that explain services, product value, industries, case studies, pricing, references, integrations, and comparisons.",
      "Ignore navigation noise, cookie text, legal boilerplate, generic blog fluff, and duplicated layout copy.",
      "When the page context is thin, generate questions from the domain, brand name, competitors, and declared country/language instead of inventing facts."
    ].join("\n")
  },
  {
    key: "prompt_generation",
    title: "Generiranje AI vprašanj",
    description: "Sistemska navodila za vprašanja, ki jih bomo poslali ChatGPT, Gemini in Claude.",
    defaultContent: [
      "Generate prompts that a real buyer would ask before choosing a vendor, product, service, agency, tool, or expert.",
      "Most prompts must be blind discovery, comparison, problem, local, or best-fit questions and must not mention the measured brand.",
      "Include only a small number of branded prompts to test whether the AI can explain the measured brand accurately.",
      "Prompts must be specific enough to reveal competitors, citations, ranking, and buying intent.",
      "Avoid vanity questions, generic SEO keywords, internal company phrasing, and questions where the measured brand is obviously forced into the answer.",
      "Use the requested language and local market context."
    ].join("\n")
  },
  {
    key: "question_blueprint",
    title: "Predloge testnih vprašanj",
    description: "Ena predloga na vrstico. Spremenljivke: {brandName}, {industry}, {country}, {localMarket}, {language}, {competitors}.",
    defaultContent: [
      "Katera podjetja v {localMarket} so najbolj primerna za {industry}?",
      "Katere rešitve bi priporočil podjetju, ki išče pomoč pri {industry}?",
      "Kako naj kupec primerja ponudnike za {industry}?",
      "Kateri ponudniki za {industry} imajo najbolj jasne reference in dokazila?",
      "Katere so najboljše alternative za {competitors}?",
      "Ali je {brandName} verodostojen ponudnik za {industry}?",
      "Kaj mora podjetje vprašati ponudnika za {industry}, preden ga izbere?"
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
