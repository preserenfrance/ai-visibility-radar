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

  it("keeps Slovenian questions readable and product-oriented", () => {
    const prompts = generatePromptSet({
      brandName: "Zaloga Pro",
      domain: "zalogapro.test",
      country: "Slovenija",
      language: "sl",
      competitors: [{ name: "Skladišče Plus" }],
      pages: [
        {
          url: "https://zalogapro.test/produkti",
          title: "Programska oprema za upravljanje zalog | Zaloga Pro",
          metaDescription: "Zaloga Pro je platforma za spremljanje zalog, naročil in dobav v realnem času.",
          h1: "Programska oprema za upravljanje zalog",
          h2: ["Funkcionalnosti za naročila", "Integracije z računovodstvom", "Podpora za slovenski trg"],
          mainText: "Platforma pomaga trgovcem primerjati zaloge, dobavne roke in naročila.",
          statusCode: 200,
          discoveredAt: new Date().toISOString()
        }
      ],
      count: 10
    });

    const allText = prompts.map((prompt) => prompt.text).join("\n");
    expect(prompts).toHaveLength(10);
    expect(prompts.every((prompt) => prompt.text.endsWith("?"))).toBe(true);
    expect(allText).not.toMatch(/[�]|Ä|Ĺ|Å|Â|Ã/);
    expect(allText).toMatch(/č|š|ž/);
    expect(allText).toMatch(/produkt|rešitev|funkcionalnosti|platforma/i);
    expect(allText).toContain("upravljanje zalog");
    expect(allText).not.toMatch(/AI Visibility Score|AI asistenti|ChatGPT.*citirajo/i);
  });
});
