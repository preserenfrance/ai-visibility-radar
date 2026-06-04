import { describe, expect, it } from "vitest";
import {
  calculateCitationScore,
  calculateRankScore,
  calculateShareOfVoiceScore,
  calculateVisibilityScore
} from "@ai-radar/scoring";
import type { ScoreInputResult } from "@ai-radar/shared";

const base: ScoreInputResult = {
  brandMentioned: true,
  brandRank: 1,
  mentionCount: 1,
  sentiment: "positive",
  accuracyScore: 90,
  competitorsMentioned: [],
  citations: []
};

describe("scoring formula", () => {
  it("scores rank positions according to the MVP mapping", () => {
    expect(calculateRankScore(null, false)).toBe(0);
    expect(calculateRankScore(1)).toBe(100);
    expect(calculateRankScore(2)).toBe(80);
    expect(calculateRankScore(3)).toBe(60);
    expect(calculateRankScore(4)).toBe(40);
    expect(calculateRankScore(5)).toBe(40);
    expect(calculateRankScore(6)).toBe(20);
  });

  it("scores citations by owned, supporting third-party, uncited mention, and no mention", () => {
    expect(
      calculateCitationScore({
        ...base,
        citations: [{ url: "https://brand.test", domain: "brand.test", isOwnedDomain: true, isCompetitorDomain: false, supportsBrand: true, supportsCompetitor: false }]
      })
    ).toBe(100);
    expect(
      calculateCitationScore({
        ...base,
        citations: [{ url: "https://review.test", domain: "review.test", isOwnedDomain: false, isCompetitorDomain: false, supportsBrand: true, supportsCompetitor: false }]
      })
    ).toBe(70);
    expect(calculateCitationScore(base)).toBe(30);
    expect(calculateCitationScore({ ...base, brandMentioned: false })).toBe(0);
  });

  it("calculates share of voice from brand and competitor mentions", () => {
    expect(
      calculateShareOfVoiceScore([
        { ...base, mentionCount: 2, competitorsMentioned: [{ name: "A", rank: 1, sentiment: "positive", evidenceText: "A" }] },
        { ...base, mentionCount: 1, competitorsMentioned: [] }
      ])
    ).toBe(75);
  });

  it("combines all weighted components into AI Visibility Score", () => {
    const score = calculateVisibilityScore([
      {
        ...base,
        citations: [{ url: "https://brand.test", domain: "brand.test", isOwnedDomain: true, isCompetitorDomain: false, supportsBrand: true, supportsCompetitor: false }]
      }
    ]);
    expect(score.visibilityScore).toBeGreaterThan(85);
    expect(score.mentionScore).toBe(100);
  });
});
