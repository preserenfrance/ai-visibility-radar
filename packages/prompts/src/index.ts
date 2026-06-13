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

const PRODUCT_TERMS = [
  "produkt",
  "produkti",
  "izdelek",
  "izdelki",
  "rešitev",
  "rešitve",
  "storitev",
  "storitve",
  "platforma",
  "programska oprema",
  "aplikacija",
  "orodje",
  "software",
  "product",
  "products",
  "solution",
  "solutions",
  "service",
  "services",
  "platform",
  "tool",
  "app"
];

const GENERIC_PAGE_TERMS = [
  "domov",
  "home",
  "o nas",
  "about",
  "kontakt",
  "contact",
  "blog",
  "novice",
  "news",
  "faq",
  "cenik",
  "pricing",
  "prijava",
  "login",
  "register",
  "registracija",
  "privacy",
  "zasebnost",
  "terms",
  "pogoji",
  "cookie",
  "piškotki",
  "menu",
  "meni",
  "search",
  "iskanje",
  "read more",
  "learn more",
  "več"
];

const BUYER_SEGMENTS = [
  "manjše podjetje",
  "rastoče B2B podjetje",
  "ekipa za prodajo",
  "marketinška ekipa",
  "operativna ekipa",
  "vodstvo podjetja",
  "podjetje z omejenim proračunom",
  "podjetje, ki potrebuje hitro uvedbo",
  "podjetje, ki potrebuje lokalno podporo",
  "podjetje, ki želi merljiv rezultat"
];

const DECISION_ANGLES = [
  "funkcionalnosti",
  "cene",
  "integracij",
  "dokazil in referenc",
  "podpore",
  "varnosti",
  "skalabilnosti",
  "uporabniške izkušnje",
  "časa uvedbe",
  "celotnih stroškov lastništva"
];

const DECISION_CONTEXTS = [
  "pri prvem nakupu",
  "pri menjavi obstoječe rešitve",
  "pri širjenju ekipe",
  "pri vstopu na slovenski trg",
  "pri integraciji z obstoječimi orodji"
];

export function generatePromptSet(input: GeneratePromptSetInput): GeneratedPrompt[] {
  const count = input.count ?? 25;
  const offer = inferOffer(input) ?? "ustrezen produkt ali storitev";
  const offerTopic = offerTopicLabel(offer);
  const localLabel = localMarketLabel(input.country);
  const competitorNames = input.competitors.map((competitor) => competitor.name.trim()).filter(Boolean);
  const firstCompetitor = competitorNames[0] ?? "najpogosteje omenjenega konkurenta";
  const candidates: GeneratedPrompt[] = [];
  const seen = new Set<string>();

  const add = (
    text: string,
    category: PromptCategory,
    intent: string,
    persona: string,
    funnelStage: GeneratedPrompt["funnelStage"]
  ) => {
    const item = prompt(text, category, intent, persona, funnelStage, input);
    const key = normalizePromptText(item.text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(item);
  };

  add(
    `Katere produkte ali rešitve naj preveri podjetje, ki v ${localLabel} išče rešitev za ${offerTopic}?`,
    "category",
    "discover product options",
    "buyer",
    "awareness"
  );
  add(
    `Kateri ponudniki imajo najbolj prepričljiv produkt za ${offerTopic} in zakaj?`,
    "best_for",
    "find strongest product",
    "growth lead",
    "consideration"
  );
  add(
    `Kako naj podjetje primerja produkte za ${offerTopic} glede funkcionalnosti, cene, podpore in dokazil?`,
    "comparison",
    "compare product options",
    "procurement lead",
    "consideration"
  );
  add(
    `Katera rešitev je najboljša za podjetje, ki potrebuje podporo za ${offerTopic}, in katere kompromise mora upoštevati?`,
    "best_for",
    "choose best fit",
    "operations lead",
    "decision"
  );
  add(
    `Kateri produkti ali ponudniki za ${offerTopic} so primerni za slovenski trg?`,
    "local",
    "local product shortlist",
    "local buyer",
    "consideration"
  );
  add(
    `Kaj ponuja ${input.brandName}, za katere kupce je produkt primeren in kje ima omejitve?`,
    "branded",
    "understand measured brand",
    "buyer",
    "decision"
  );

  for (const competitor of competitorNames) {
    add(
      `Kako se produkt ${input.brandName} primerja s produktom ${competitor} glede funkcionalnosti, cene, podpore in dokazil?`,
      "comparison",
      "compare measured brand with competitor",
      "procurement lead",
      "decision"
    );
    add(
      `Katere alternative za ${competitor} naj preveri kupec, ki išče rešitev za ${offerTopic}?`,
      "competitor_alternative",
      "find product alternatives",
      "buyer",
      "consideration"
    );
  }

  for (const theme of extractPageThemes(input.pages, input.brandName)) {
    add(
      `Kateri produkt ali rešitev najbolje pokrije potrebo "${theme}"?`,
      "category",
      "product need shortlist",
      "department head",
      "consideration"
    );
    add(
      `Katere funkcionalnosti mora imeti dober produkt za "${theme}", preden ga podjetje izbere?`,
      "problem",
      "product qualification checklist",
      "operations lead",
      "awareness"
    );
  }

  const fallbacks: Array<[PromptCategory, string, string, string, GeneratedPrompt["funnelStage"]]> = [
    [
      "category",
      `Katere tri rešitve bi moral kupec uvrstiti v ožji izbor za ${offerTopic}?`,
      "product shortlist",
      "buyer",
      "awareness"
    ],
    [
      "problem",
      `Na katera vprašanja mora kupec dobiti jasen odgovor, preden izbere produkt za ${offerTopic}?`,
      "buying questions",
      "operations lead",
      "awareness"
    ],
    [
      "comparison",
      `Primerjaj najpogostejše produkte za ${offerTopic} po funkcionalnostih, ceni, podpori in dokazilih.`,
      "product comparison",
      "buyer",
      "consideration"
    ],
    [
      "best_for",
      `Katera rešitev za ${offerTopic} je najboljša za podjetje, ki želi hitro uvedbo in merljiv rezultat?`,
      "best fit by outcome",
      "growth lead",
      "decision"
    ],
    [
      "local",
      `Kateri ponudniki za ${offerTopic} imajo v ${localLabel} najbolj uporabne reference, podporo in lokalno razumevanje?`,
      "local proof",
      "regional director",
      "consideration"
    ],
    [
      "branded",
      `Ali je ${input.brandName} dobra izbira za kupca, ki išče rešitev za ${offerTopic}?`,
      "brand fit",
      "buyer",
      "decision"
    ],
    [
      "competitor_alternative",
      `Katere alternative za ${firstCompetitor} so bolj primerne za kupca, ki išče rešitev za ${offerTopic}?`,
      "alternatives",
      "buyer",
      "consideration"
    ],
    [
      "problem",
      `Kateri znaki pokažejo, da produkt za ${offerTopic} ni primeren za potrebe podjetja?`,
      "risk evaluation",
      "operations lead",
      "awareness"
    ],
    [
      "comparison",
      `Kako naj podjetje primerja ponudnike za ${offerTopic}, če želi manj tveganja pri nakupu?`,
      "reduce buying risk",
      "procurement lead",
      "consideration"
    ],
    [
      "best_for",
      `Kateri produkt za ${offerTopic} je najbolj primeren za podjetje, ki nima velike interne ekipe?`,
      "lean team fit",
      "founder",
      "decision"
    ],
    [
      "category",
      `Kateri ponudniki za ${offerTopic} imajo najbolj jasno razložene funkcionalnosti in prednosti?`,
      "clear product value",
      "buyer",
      "awareness"
    ],
    [
      "problem",
      `Kaj mora podjetje pripraviti, preden začne uvajati produkt za ${offerTopic}?`,
      "implementation readiness",
      "project lead",
      "awareness"
    ]
  ];

  for (const [category, text, intent, persona, funnelStage] of fallbacks) {
    if (candidates.length >= count) break;
    add(text, category, intent, persona, funnelStage);
  }

  let dynamicIndex = 0;
  const maxDynamicPrompts = BUYER_SEGMENTS.length * DECISION_ANGLES.length * DECISION_CONTEXTS.length;
  while (candidates.length < count && dynamicIndex < maxDynamicPrompts) {
    const segment = BUYER_SEGMENTS[dynamicIndex % BUYER_SEGMENTS.length]!;
    const angle = DECISION_ANGLES[Math.floor(dynamicIndex / BUYER_SEGMENTS.length) % DECISION_ANGLES.length]!;
    const context =
      DECISION_CONTEXTS[Math.floor(dynamicIndex / (BUYER_SEGMENTS.length * DECISION_ANGLES.length)) % DECISION_CONTEXTS.length]!;
    add(
      `Kateri produkt za ${offerTopic} naj izbere ${segment}, če je najpomembnejše merilo ${angle} ${context}?`,
      dynamicIndex % 2 === 0 ? "best_for" : "comparison",
      "product fit by buyer segment",
      "buyer",
      dynamicIndex % 2 === 0 ? "decision" : "consideration"
    );
    dynamicIndex += 1;
  }

  return candidates.slice(0, count).map((item, index) => ({
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
    text: ensureQuestion(text),
    category,
    intent,
    persona,
    funnelStage,
    priority: 1,
    language: input.language,
    country: input.country
  };
}

function offerTopicLabel(offer: string) {
  return `področje "${offer}"`;
}

function inferOffer(input: GeneratePromptSetInput): string | undefined {
  const explicit = cleanOffer(input.industry, input.brandName);
  if (explicit) return explicit;
  return extractOfferCandidates(input.pages, input.brandName)[0];
}

function extractOfferCandidates(pages: CrawledPageSnapshot[], brandName: string): string[] {
  const candidates: string[] = [];
  const add = (value?: string) => {
    const cleaned = cleanOffer(value, brandName);
    if (cleaned) candidates.push(cleaned);
  };

  for (const page of pages.slice(0, 10)) {
    add(page.h1);
    for (const heading of page.h2.slice(0, 10)) add(heading);
    add(page.title);
    add(page.metaDescription);
    for (const schemaText of schemaOfferText(page.schemaJson)) add(schemaText);
  }

  const unique = dedupe(candidates);
  const productFirst = unique.filter(containsProductTerm);
  return [...productFirst, ...unique.filter((candidate) => !containsProductTerm(candidate))].slice(0, 8);
}

function extractPageThemes(pages: CrawledPageSnapshot[], brandName: string): string[] {
  return extractOfferCandidates(pages, brandName)
    .filter((candidate) => candidate.length >= 8 && candidate.length <= 80)
    .slice(0, 6);
}

function cleanOffer(value: string | null | undefined, brandName: string): string | undefined {
  if (!value) return undefined;
  let cleaned = value
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[’]/g, "'")
    .trim();

  if (!cleaned) return undefined;
  cleaned = cleaned.split(/\s[|–—]\s/)[0]!.trim();
  if (brandName.trim()) {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(brandName), "gi"), "").trim();
  }
  cleaned = cleaned.replace(/^[\s:;,.!?-]+|[\s:;,.!?-]+$/g, "").trim();

  if (cleaned.length < 5 || cleaned.length > 100) return undefined;
  if (looksGeneric(cleaned)) return undefined;
  if (looksLikeSentenceNoise(cleaned)) return undefined;

  return lowerFirstWord(cleaned);
}

function looksGeneric(value: string) {
  const lower = value.toLowerCase();
  return GENERIC_PAGE_TERMS.some((term) => lower === term || lower.startsWith(`${term} `));
}

function looksLikeSentenceNoise(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("all rights reserved") || lower.includes("vse pravice pridržane")) return true;
  if (lower.includes("cookie") || lower.includes("piškot")) return true;
  if (lower.includes("subscribe") || lower.includes("naroči")) return true;
  return false;
}

function containsProductTerm(value: string) {
  const lower = value.toLowerCase();
  return PRODUCT_TERMS.some((term) => lower.includes(term));
}

function lowerFirstWord(value: string) {
  if (/^[A-ZČŠŽ][a-zčšž]/.test(value)) {
    return value.charAt(0).toLowerCase() + value.slice(1);
  }
  return value;
}

function schemaOfferText(value: unknown): string[] {
  const output: string[] = [];
  collectSchemaStrings(value, output);
  return output.slice(0, 12);
}

function collectSchemaStrings(value: unknown, output: string[]) {
  if (!value || output.length >= 12) return;
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaStrings(item, output);
    return;
  }
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  for (const key of ["name", "description", "serviceType", "category", "applicationCategory"]) {
    const field = record[key];
    if (typeof field === "string") output.push(field);
  }
  for (const field of Object.values(record)) collectSchemaStrings(field, output);
}

function ensureQuestion(value: string) {
  const text = value.replace(/\s+/g, " ").trim().replace(/[.。]+$/, "");
  return text.endsWith("?") ? text : `${text}?`;
}

function normalizePromptText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = normalizePromptText(value);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function localMarketLabel(country: string): string {
  const lower = country.toLowerCase();
  if (lower === "slovenia" || lower === "slovenija" || lower === "si") return "Sloveniji";
  return country;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
