import type { ScoreBreakdown, ScoreInputResult, Sentiment } from "@ai-radar/shared";

const round = (value: number) => Math.round(Math.max(0, Math.min(100, value)));

export function calculateRankScore(rank: number | null, brandMentioned = rank !== null): number {
  if (!brandMentioned || rank === null) return 0;
  if (rank === 1) return 100;
  if (rank === 2) return 80;
  if (rank === 3) return 60;
  if (rank === 4 || rank === 5) return 40;
  return 20;
}

export function calculateCitationScore(result: ScoreInputResult): number {
  if (!result.brandMentioned) return 0;

  const hasOwnedCitation = result.citations.some((citation) => citation.isOwnedDomain);
  if (hasOwnedCitation) return 100;

  const hasSupportingThirdParty = result.citations.some(
    (citation) => citation.supportsBrand && !citation.isOwnedDomain
  );
  if (hasSupportingThirdParty) return 70;

  return 30;
}

export function calculateShareOfVoiceScore(results: ScoreInputResult[]): number {
  const brandMentions = results.reduce((sum, result) => sum + result.mentionCount, 0);
  const competitorMentions = results.reduce(
    (sum, result) => sum + result.competitorsMentioned.length,
    0
  );
  const total = brandMentions + competitorMentions;
  if (total === 0) return 0;
  return round((brandMentions / total) * 100);
}

export function calculateSentimentScore(sentiment: Sentiment): number {
  switch (sentiment) {
    case "positive":
      return 100;
    case "neutral":
      return 60;
    case "mixed":
      return 40;
    case "negative":
      return 0;
  }
}

export function calculateVisibilityScore(results: ScoreInputResult[]): ScoreBreakdown {
  if (results.length === 0) {
    return {
      visibilityScore: 0,
      mentionScore: 0,
      rankScore: 0,
      citationScore: 0,
      shareOfVoiceScore: 0,
      sentimentScore: 0,
      accuracyScore: 0
    };
  }

  const mentionScore = average(results.map((result) => (result.brandMentioned ? 100 : 0)));
  const rankScore = average(
    results.map((result) => calculateRankScore(result.brandRank, result.brandMentioned))
  );
  const citationScore = average(results.map(calculateCitationScore));
  const shareOfVoiceScore = calculateShareOfVoiceScore(results);
  const sentimentScore = average(results.map((result) => calculateSentimentScore(result.sentiment)));

  const mentionedResults = results.filter((result) => result.brandMentioned);
  const accuracyScore =
    mentionedResults.length === 0
      ? 0
      : average(mentionedResults.map((result) => result.accuracyScore));

  const visibilityScore =
    mentionScore * 0.25 +
    rankScore * 0.2 +
    citationScore * 0.2 +
    shareOfVoiceScore * 0.15 +
    sentimentScore * 0.1 +
    accuracyScore * 0.1;

  return {
    visibilityScore: round(visibilityScore),
    mentionScore: round(mentionScore),
    rankScore: round(rankScore),
    citationScore: round(citationScore),
    shareOfVoiceScore: round(shareOfVoiceScore),
    sentimentScore: round(sentimentScore),
    accuracyScore: round(accuracyScore)
  };
}

export type RecommendationDraft = {
  title: string;
  description: string;
  impactScore: number;
  effortScore: number;
  affectedPromptsJson: string[];
  affectedEnginesJson: string[];
};

export function generateRecommendationDrafts(
  results: Array<ScoreInputResult & { prompt?: string; engine?: string }>
): RecommendationDraft[] {
  const losingPrompts = results
    .filter((result) => !result.brandMentioned || (result.brandRank ?? 99) > 3)
    .map((result) => result.prompt)
    .filter((prompt): prompt is string => Boolean(prompt))
    .slice(0, 8);
  const hasAccuracyIssues = results.some((result) => result.brandMentioned && result.accuracyScore < 70);
  const hasCitationGap = results.some(
    (result) => result.brandMentioned && !result.citations.some((citation) => citation.isOwnedDomain)
  );
  const competitorWins = results.some((result) => {
    const bestCompetitorRank = Math.min(
      ...result.competitorsMentioned.map((competitor) => competitor.rank ?? 99)
    );
    return bestCompetitorRank < (result.brandRank ?? 99);
  });

  const drafts: RecommendationDraft[] = [];
  if (competitorWins) {
    drafts.push({
      title: "Dodaj stran za primerjavo z najpogosteje omenjenim konkurentom.",
      description:
        "AI asistenti pogosteje izpostavijo konkurenco. Ustvari jasno primerjalno stran z razlikami, primeri uporabe in dokazili.",
      impactScore: 90,
      effortScore: 55,
      affectedPromptsJson: losingPrompts,
      affectedEnginesJson: affectedEngines(results)
    });
  }

  if (hasAccuracyIssues) {
    drafts.push({
      title: "Popravi About stran, ker AI napačno opiše ponudbo.",
      description:
        "Dodaj jedrnat opis ponudbe, komu je namenjena, dokazila in strukturirane podatke Organization/Service.",
      impactScore: 85,
      effortScore: 35,
      affectedPromptsJson: losingPrompts,
      affectedEnginesJson: affectedEngines(results)
    });
  }

  if (hasCitationGap) {
    drafts.push({
      title: "Pridobi omembo na viru, ki ga AI pogosto citira.",
      description:
        "Okrepi tretje vire in poskrbi, da ključne strani na domeni jasno podpirajo brand in kategorijo.",
      impactScore: 80,
      effortScore: 65,
      affectedPromptsJson: losingPrompts,
      affectedEnginesJson: affectedEngines(results)
    });
  }

  if (losingPrompts.length > 0) {
    drafts.push({
      title: "Dodaj FAQ za vprašanja, kjer AI omenja konkurenco.",
      description:
        "Uporabi izgubljene prompte kot osnutek FAQ in odgovorov, ki pokrijejo problem, primerjavo ter lokalni kontekst.",
      impactScore: 75,
      effortScore: 30,
      affectedPromptsJson: losingPrompts,
      affectedEnginesJson: affectedEngines(results)
    });
  }

  if (drafts.length === 0) {
    drafts.push({
      title: "Ponovi scan in spremljaj trend.",
      description:
        "Rezultat je trenutno stabilen. Ohranite zgodovino scanov in spremljajte spremembe po novih objavah ali virih.",
      impactScore: 45,
      effortScore: 20,
      affectedPromptsJson: [],
      affectedEnginesJson: affectedEngines(results)
    });
  }

  return drafts.slice(0, 5);
}

export type LeadScoreInput = {
  email: string;
  competitorCount: number;
  crawledPageCount: number;
  visibilityScore?: number;
  competitorHasDoubleMentions?: boolean;
  openedReport?: boolean;
  clickedDemo?: boolean;
};

export function calculateLeadScore(input: LeadScoreInput): number {
  let score = 0;
  if (isBusinessEmail(input.email)) score += 15;
  if (input.competitorCount > 0) score += 10;
  if (input.crawledPageCount > 10) score += 10;
  if ((input.visibilityScore ?? 100) < 40) score += 20;
  if (input.competitorHasDoubleMentions) score += 20;
  if (input.openedReport) score += 10;
  if (input.clickedDemo) score += 30;
  return round(score);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function affectedEngines(results: Array<{ engine?: string }>): string[] {
  return [...new Set(results.map((result) => result.engine).filter((engine): engine is string => Boolean(engine)))];
}

function isBusinessEmail(email: string): boolean {
  const freeDomains = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]);
  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain && !freeDomains.has(domain));
}
