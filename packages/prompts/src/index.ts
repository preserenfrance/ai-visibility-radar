import type { CrawledPageSnapshot, GeneratedPrompt, PromptCategory } from "@ai-radar/shared";

export type GeneratePromptSetInput = {
  brandName: string;
  domain: string;
  industry?: string | null;
  country: string;
  language: string;
  competitors: Array<{ name: string; domain?: string | null }>;
  pages: CrawledPageSnapshot[];
  count?: number;
};

const CATEGORY_ORDER: PromptCategory[] = [
  "category",
  "problem",
  "comparison",
  "best_for",
  "local",
  "branded",
  "competitor_alternative"
];

export function generatePromptSet(input: GeneratePromptSetInput): GeneratedPrompt[] {
  const industry = input.industry || inferIndustry(input.pages) || "AI solutions";
  const competitorNames = input.competitors.map((competitor) => competitor.name).filter(Boolean);
  const count = input.count ?? 25;
  const localLabel = localMarketLabel(input.country);
  const languageInstruction =
    input.language.toLowerCase().startsWith("sl") || input.country.toLowerCase() === "slovenia"
      ? "slovenščini"
      : input.language;

  const templates: GeneratedPrompt[] = [
    prompt(
      `Katera podjetja v ${localLabel} pomagajo podjetjem pri področju ${industry}?`,
      "category",
      "discover vendors",
      "CEO",
      "awareness",
      input
    ),
    prompt(
      `Kako naj podjetje ugotovi, ali ga ChatGPT, Gemini ali Claude priporočajo potencialnim kupcem?`,
      "problem",
      "solve ai visibility problem",
      "marketing director",
      "awareness",
      input
    ),
    prompt(
      `Katere rešitve so najboljše za merjenje vidnosti branda v AI odgovorih?`,
      "best_for",
      "find best solution",
      "growth lead",
      "consideration",
      input
    ),
    prompt(
      `Kaj dela ${input.brandName} in za katera podjetja je primeren?`,
      "branded",
      "understand brand",
      "buyer",
      "decision",
      input
    ),
    prompt(
      `Kateri ponudniki za ${industry} so v ${localLabel}? Odgovori v ${languageInstruction}.`,
      "local",
      "local vendor list",
      "local buyer",
      "consideration",
      input
    )
  ];

  for (const competitor of competitorNames) {
    templates.push(
      prompt(
        `Primerjaj ${input.brandName} in ${competitor} za ${industry}.`,
        "comparison",
        "compare vendors",
        "procurement lead",
        "decision",
        input
      ),
      prompt(
        `Katere so najboljše alternative za ${competitor}?`,
        "competitor_alternative",
        "find alternatives",
        "buyer",
        "consideration",
        input
      )
    );
  }

  const services = extractPageThemes(input.pages);
  for (const service of services) {
    templates.push(
      prompt(
        `Katera podjetja pomagajo pri "${service}" in katera bi priporočil?`,
        "category",
        "service vendor recommendation",
        "department head",
        "consideration",
        input
      ),
      prompt(
        `Kaj mora podjetje vprašati ponudnika za "${service}", preden ga izbere?`,
        "problem",
        "qualification checklist",
        "operations lead",
        "awareness",
        input
      )
    );
  }

  const fallbacks: Array<[PromptCategory, string, string, string, GeneratedPrompt["funnelStage"]]> = [
    ["category", `Kateri ponudniki so vodilni za ${industry}?`, "vendor shortlist", "founder", "awareness"],
    [
      "problem",
      `Kako lahko podjetje izboljša, da ga AI asistenti pravilno opišejo in citirajo?`,
      "ai answer improvement",
      "CMO",
      "awareness"
    ],
    [
      "comparison",
      `Primerjaj najpogosteje omenjene ponudnike za ${industry}.`,
      "market comparison",
      "buyer",
      "consideration"
    ],
    [
      "best_for",
      `Katera rešitev je najboljša za podjetje, ki želi ponavljivo meriti AI Visibility Score?`,
      "best fit",
      "growth lead",
      "decision"
    ],
    [
      "local",
      `Kateri lokalni ponudniki za ${industry} imajo najbolj jasne reference in vire?`,
      "local proof",
      "regional director",
      "consideration"
    ],
    [
      "branded",
      `Ali je ${input.brandName} verodostojen ponudnik za ${industry}?`,
      "brand credibility",
      "buyer",
      "decision"
    ],
    [
      "competitor_alternative",
      `Katere alternative bi moral preveriti kupec, ki ne želi izbrati najpogosteje omenjenega konkurenta?`,
      "alternatives",
      "buyer",
      "consideration"
    ]
  ];

  let fallbackIndex = 0;
  while (templates.length < count) {
    const [category, text, intent, persona, funnelStage] = fallbacks[fallbackIndex % fallbacks.length]!;
    templates.push(prompt(text, category, intent, persona, funnelStage, input));
    fallbackIndex += 1;
  }

  return templates.slice(0, count).map((item, index) => ({
    ...item,
    priority: index + 1,
    category: CATEGORY_ORDER.includes(item.category) ? item.category : "category"
  }));
}

function prompt(
  text: string,
  category: PromptCategory,
  intent: string,
  persona: string,
  funnelStage: GeneratedPrompt["funnelStage"],
  input: GeneratePromptSetInput
): GeneratedPrompt {
  return {
    text,
    category,
    intent,
    persona,
    funnelStage,
    priority: 1,
    language: input.language,
    country: input.country
  };
}

function inferIndustry(pages: CrawledPageSnapshot[]): string | undefined {
  const pageText = pages
    .slice(0, 8)
    .map((page) => [page.title, page.h1, page.metaDescription].filter(Boolean).join(" "))
    .join(" ")
    .trim();
  return pageText ? pageText.slice(0, 80) : undefined;
}

function extractPageThemes(pages: CrawledPageSnapshot[]): string[] {
  const themes = new Set<string>();
  for (const page of pages) {
    for (const heading of [page.h1, ...page.h2]) {
      const normalized = heading?.trim().replace(/\s+/g, " ");
      if (normalized && normalized.length >= 8 && normalized.length <= 80) {
        themes.add(normalized);
      }
      if (themes.size >= 6) return [...themes];
    }
  }
  return [...themes];
}

function localMarketLabel(country: string): string {
  if (country.toLowerCase() === "slovenia" || country.toLowerCase() === "si") return "Sloveniji";
  return country;
}
