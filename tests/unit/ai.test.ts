import { describe, expect, it } from "vitest";
import { buildProviderPrompt, extractAiSearchCalls } from "@ai-radar/ai";

describe("AI provider prompt", () => {
  it("does not leak the measured brand into blind discovery prompts", () => {
    const prompt = buildProviderPrompt({
      prompt:
        "Katera podjetja v Sloveniji pomagajo podjetjem pri SEO optimizaciji?",
      language: "sl",
      country: "Slovenija",
      brandName: "Skrita Znamka",
      brandDomain: "skrita-znamka.si",
      competitors: [{ name: "Glavni Konkurent", domain: "konkurent.si" }],
      searchEnabled: false,
    });

    expect(prompt).toContain("Katera podjetja v Sloveniji");
    expect(prompt).toContain("Answer in natural Slovenian");
    expect(prompt).not.toContain("Skrita Znamka");
    expect(prompt).not.toContain("skrita-znamka.si");
    expect(prompt).not.toContain("Glavni Konkurent");
    expect(prompt).not.toContain("konkurent.si");
  });
});

describe("AI search call extraction", () => {
  it("extracts OpenAI web search query and sources", () => {
    const calls = extractAiSearchCalls("openai", {
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            query: "best AI visibility tools",
            sources: [
              {
                type: "source",
                url: "https://example.com/ai-tools",
                title: "AI tools",
              },
            ],
          },
        },
      ],
    });

    expect(calls).toEqual([
      {
        provider: "openai",
        actionType: "search",
        query: "best AI visibility tools",
        exact: true,
        sources: [
          {
            url: "https://example.com/ai-tools",
            title: "AI tools",
            domain: "example.com",
          },
        ],
      },
    ]);
  });

  it("extracts Gemini grounding queries", () => {
    const calls = extractAiSearchCalls("google", {
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: [
              "AI visibility monitoring Slovenia",
              "LLM visibility tools",
            ],
          },
        },
      ],
    });

    expect(calls.map((call) => call.query)).toEqual([
      "AI visibility monitoring Slovenia",
      "LLM visibility tools",
    ]);
    expect(calls.every((call) => call.exact)).toBe(true);
  });

  it("connects Claude web search queries to returned result sources", () => {
    const calls = extractAiSearchCalls("anthropic", {
      content: [
        {
          type: "server_tool_use",
          id: "srvtoolu_1",
          name: "web_search",
          input: { query: "latest generative engine optimization tools" },
        },
        {
          type: "web_search_tool_result",
          tool_use_id: "srvtoolu_1",
          content: [
            {
              type: "web_search_result",
              title: "GEO tools guide",
              url: "https://example.org/geo-tools",
            },
          ],
        },
      ],
    });

    expect(calls[0]).toMatchObject({
      provider: "anthropic",
      actionType: "search",
      query: "latest generative engine optimization tools",
      exact: true,
      sources: [
        {
          url: "https://example.org/geo-tools",
          title: "GEO tools guide",
          domain: "example.org",
        },
      ],
    });
  });
});
