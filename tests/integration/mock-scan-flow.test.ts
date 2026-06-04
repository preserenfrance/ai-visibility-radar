import { describe, expect, it } from "vitest";
import { MockAiAdapter } from "@ai-radar/ai";
import { parseAiResponse } from "@ai-radar/parser";
import { generatePromptSet } from "@ai-radar/prompts";
import { calculateVisibilityScore } from "@ai-radar/scoring";

describe("mock provider scan flow", () => {
  it("generates prompts, runs mock provider, parses responses, and scores a dashboard result", async () => {
    const prompts = generatePromptSet({
      brandName: "Brand X",
      domain: "brandx.test",
      industry: "AI consulting",
      country: "Slovenia",
      language: "sl",
      competitors: [{ name: "Competitor A" }],
      pages: [],
      count: 5
    });
    const adapter = new MockAiAdapter();
    const parsed = [];
    for (const prompt of prompts) {
      const output = await adapter.runPrompt({
        prompt: `${prompt.text} competitor mentioned owned domain cited`,
        language: "sl",
        country: "Slovenia",
        brandName: "Brand X",
        brandDomain: "brandx.test",
        competitors: [{ name: "Competitor A" }],
        searchEnabled: false
      });
      parsed.push(
        await parseAiResponse({
          brandName: "Brand X",
          brandDomain: "brandx.test",
          competitors: [{ name: "Competitor A" }],
          prompt: prompt.text,
          rawAiAnswer: output.rawText,
          citations: output.citations,
          parserProvider: "mock"
        })
      );
    }
    const score = calculateVisibilityScore(parsed);
    expect(score.visibilityScore).toBeGreaterThan(0);
    expect(score.mentionScore).toBe(100);
  });
});
