import { describe, expect, it } from "vitest";
import { generatePromptSet } from "@ai-radar/prompts";

describe("prompt generator output", () => {
  it("generates 25 prompts with all required fields", () => {
    const prompts = generatePromptSet({
      brandName: "Brand X",
      domain: "brandx.test",
      industry: "AI consulting",
      country: "Slovenia",
      language: "sl",
      competitors: [{ name: "Competitor A" }],
      pages: []
    });
    expect(prompts).toHaveLength(25);
    expect(prompts.every((prompt) => prompt.text && prompt.category && prompt.intent && prompt.persona)).toBe(true);
    expect(new Set(prompts.map((prompt) => prompt.category)).has("competitor_alternative")).toBe(true);
  });
});
