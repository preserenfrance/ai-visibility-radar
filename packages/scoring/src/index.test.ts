import { describe, expect, it } from "vitest";
import type { ScoreInputResult } from "@ai-radar/shared";
import { calculateShareOfVoiceScore, calculateVisibilityScore } from "./index";

function result(input: Partial<ScoreInputResult>): ScoreInputResult {
  return {
    brandMentioned: false,
    brandRank: null,
    mentionCount: 0,
    sentiment: "neutral",
    accuracyScore: 0,
    competitorsMentioned: [],
    citations: [],
    ...input,
  };
}

describe("calculateVisibilityScore", () => {
  it("returns zero visibility when the brand is never mentioned", () => {
    const score = calculateVisibilityScore([
      result({
        competitorsMentioned: [
          {
            name: "Competitor",
            rank: 1,
            sentiment: "positive",
            evidenceText: "Competitor is recommended.",
          },
        ],
      }),
      result({
        competitorsMentioned: [
          {
            name: "Another competitor",
            rank: 2,
            sentiment: "neutral",
            evidenceText: "Another competitor is listed.",
          },
        ],
      }),
    ]);

    expect(score.visibilityScore).toBe(0);
    expect(score.mentionScore).toBe(0);
    expect(score.rankScore).toBe(0);
    expect(score.citationScore).toBe(0);
    expect(score.shareOfVoiceScore).toBe(0);
    expect(score.sentimentScore).toBe(0);
    expect(score.accuracyScore).toBe(0);
  });

  it("ignores mention counts on unmentioned brand results", () => {
    const results = [
      result({
        mentionCount: 3,
        competitorsMentioned: [
          {
            name: "Competitor",
            rank: 1,
            sentiment: "positive",
            evidenceText: "Competitor is recommended.",
          },
        ],
      }),
    ];

    expect(calculateShareOfVoiceScore(results)).toBe(0);
    expect(calculateVisibilityScore(results).visibilityScore).toBe(0);
  });
});
