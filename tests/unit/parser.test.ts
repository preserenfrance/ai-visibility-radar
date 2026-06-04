import { describe, expect, it } from "vitest";
import { parseWithRules, parsedAiResultSchema } from "@ai-radar/parser";

describe("parser schema validation", () => {
  it("extracts brand mentions, rank, competitors, sentiment, and citations", () => {
    const parsed = parseWithRules({
      brandName: "Brand X",
      brandDomain: "brandx.test",
      competitors: [{ name: "Competitor A", domain: "competitor.test" }],
      prompt: "Compare providers",
      rawAiAnswer: "1. Competitor A is a known alternative.\n2. Brand X is a strong option for AI visibility.",
      citations: [{ url: "https://brandx.test/about", domain: "brandx.test" }]
    });
    expect(parsedAiResultSchema.parse(parsed).brandMentioned).toBe(true);
    expect(parsed.brandRank).toBe(2);
    expect(parsed.competitorsMentioned[0]?.name).toBe("Competitor A");
    expect(parsed.citations[0]?.isOwnedDomain).toBe(true);
  });

  it("sets brandRank to null when the brand is not mentioned", () => {
    const parsed = parseWithRules({
      brandName: "Brand X",
      brandDomain: "brandx.test",
      competitors: [{ name: "Competitor A" }],
      prompt: "brand not mentioned",
      rawAiAnswer: "1. Competitor A is often recommended.",
      citations: []
    });
    expect(parsed.brandMentioned).toBe(false);
    expect(parsed.brandRank).toBeNull();
  });
});
