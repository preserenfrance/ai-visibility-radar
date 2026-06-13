import { describe, expect, it } from "vitest";
import { buildProviderPrompt } from "@ai-radar/ai";

describe("AI provider prompt", () => {
  it("does not leak the measured brand into blind discovery prompts", () => {
    const prompt = buildProviderPrompt({
      prompt: "Katera podjetja v Sloveniji pomagajo podjetjem pri SEO optimizaciji?",
      language: "sl",
      country: "Slovenija",
      brandName: "Skrita Znamka",
      brandDomain: "skrita-znamka.si",
      competitors: [{ name: "Glavni Konkurent", domain: "konkurent.si" }],
      searchEnabled: false
    });

    expect(prompt).toContain("Katera podjetja v Sloveniji");
    expect(prompt).toContain("Answer in natural Slovenian");
    expect(prompt).not.toContain("Skrita Znamka");
    expect(prompt).not.toContain("skrita-znamka.si");
    expect(prompt).not.toContain("Glavni Konkurent");
    expect(prompt).not.toContain("konkurent.si");
  });
});
