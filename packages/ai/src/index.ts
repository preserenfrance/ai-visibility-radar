import { getConfig } from "@ai-radar/config";
import {
  domainFromUrl,
  type AiCitation,
  type AiEngineAdapter,
  type AiEngineProvider,
  type RunPromptInput,
  type RunPromptOutput,
} from "@ai-radar/shared";

export type CreateAiAdapterOptions = {
  modelOverride?: string;
  searchEnabled?: boolean;
};

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const LANGUAGE_NAMES: Record<string, string> = {
  sl: "Slovenian",
  en: "English",
  de: "German",
  hr: "Croatian",
  sr: "Serbian",
  bs: "Bosnian",
  it: "Italian",
  hu: "Hungarian",
  fr: "French",
  es: "Spanish",
  nl: "Dutch",
  cs: "Czech",
  sk: "Slovak",
  pl: "Polish",
  ro: "Romanian",
  bg: "Bulgarian",
  mk: "Macedonian",
  sq: "Albanian",
  uk: "Ukrainian",
  ru: "Russian",
  pt: "Portuguese",
  da: "Danish",
  sv: "Swedish",
  no: "Norwegian",
  fi: "Finnish",
  el: "Greek",
  tr: "Turkish",
};

export function createAiAdapter(
  provider: AiEngineProvider,
  options: CreateAiAdapterOptions = {},
): AiEngineAdapter {
  switch (provider) {
    case "openai":
      return new OpenAiResponsesAdapter(options);
    case "google":
      return new GeminiGroundingAdapter(options);
    case "anthropic":
      return new ClaudeMessagesAdapter(options);
    case "mock":
      return new MockAiAdapter(options);
  }
}

export function buildProviderPrompt(input: RunPromptInput): string {
  return [
    answerLanguageInstruction(input.language),
    `Use ${input.country} as the buyer's market when the question depends on location.`,
    "Answer naturally as an AI assistant would to a buyer. If you use sources, cite them in the provider-native way.",
    "Do not ask follow-up questions; the user cannot answer them. Give the best complete answer you can with the available information.",
    "Do not assume any hidden brand, competitor, or evaluation context beyond the user's question.",
    "",
    input.prompt,
  ].join("\n");
}

function answerLanguageInstruction(language: string) {
  const lower = language.trim().toLowerCase();
  if (lower === "sl" || lower.includes("sloven")) {
    return "Answer in natural Slovenian with correct č, š and ž.";
  }
  return `Answer in ${LANGUAGE_NAMES[lower] ?? language}.`;
}

class OpenAiResponsesAdapter implements AiEngineAdapter {
  private readonly config = getConfig();

  constructor(private readonly options: CreateAiAdapterOptions) {}

  async runPrompt(input: RunPromptInput): Promise<RunPromptOutput> {
    const apiKey = this.config.OPENAI_API_KEY;
    const model =
      this.options.modelOverride ??
      this.config.OPENAI_MODEL ??
      DEFAULT_OPENAI_MODEL;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");

    const searchEnabled = this.options.searchEnabled ?? input.searchEnabled;
    const body: Record<string, unknown> = {
      model,
      input: buildProviderPrompt({ ...input, searchEnabled }),
      include: searchEnabled ? ["web_search_call.action.sources"] : undefined,
    };

    if (searchEnabled) {
      body.tools = [
        {
          type: "web_search",
          search_context_size: "medium",
        },
      ];
      body.tool_choice = "auto";
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawJson = await response.json();
    if (!response.ok) {
      throw new Error(
        `OpenAI Responses API error ${response.status}: ${JSON.stringify(rawJson)}`,
      );
    }

    return {
      provider: "openai",
      model,
      rawText: extractOpenAiText(rawJson),
      rawJson,
      citations: extractOpenAiCitations(rawJson),
      inputTokens: rawJson?.usage?.input_tokens,
      outputTokens: rawJson?.usage?.output_tokens,
    };
  }
}

class GeminiGroundingAdapter implements AiEngineAdapter {
  private readonly config = getConfig();

  constructor(private readonly options: CreateAiAdapterOptions) {}

  async runPrompt(input: RunPromptInput): Promise<RunPromptOutput> {
    const apiKey = this.config.GEMINI_API_KEY;
    const model = this.options.modelOverride ?? this.config.GEMINI_MODEL;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required");
    if (!model) throw new Error("GEMINI_MODEL is required");

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const searchEnabled = this.options.searchEnabled ?? input.searchEnabled;
    const response = await ai.models.generateContent({
      model,
      contents: buildProviderPrompt({ ...input, searchEnabled }),
      config: searchEnabled
        ? {
            tools: [
              {
                googleSearch: {},
              },
            ],
          }
        : undefined,
    });

    const rawJson = JSON.parse(JSON.stringify(response));
    return {
      provider: "google",
      model,
      rawText: response.text ?? extractGeminiText(rawJson),
      rawJson,
      citations: extractGeminiCitations(rawJson),
      inputTokens: rawJson?.usageMetadata?.promptTokenCount,
      outputTokens: rawJson?.usageMetadata?.candidatesTokenCount,
    };
  }
}

class ClaudeMessagesAdapter implements AiEngineAdapter {
  private readonly config = getConfig();

  constructor(private readonly options: CreateAiAdapterOptions) {}

  async runPrompt(input: RunPromptInput): Promise<RunPromptOutput> {
    const apiKey = this.config.ANTHROPIC_API_KEY;
    const model = this.options.modelOverride ?? this.config.CLAUDE_MODEL;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
    if (!model) throw new Error("CLAUDE_MODEL is required");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });
    const searchEnabled = this.options.searchEnabled ?? input.searchEnabled;
    const message = await (anthropic.messages as any).create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildProviderPrompt({ ...input, searchEnabled }),
        },
      ],
      tools: searchEnabled
        ? [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 5,
            },
          ]
        : undefined,
    });

    const rawJson = JSON.parse(JSON.stringify(message));
    return {
      provider: "anthropic",
      model,
      rawText: extractAnthropicText(rawJson),
      rawJson,
      citations: extractAnthropicCitations(rawJson),
      inputTokens: rawJson?.usage?.input_tokens,
      outputTokens: rawJson?.usage?.output_tokens,
    };
  }
}

export class MockAiAdapter implements AiEngineAdapter {
  constructor(private readonly options: CreateAiAdapterOptions = {}) {}

  async runPrompt(input: RunPromptInput): Promise<RunPromptOutput> {
    const lower = input.prompt.toLowerCase();
    const competitor = input.competitors[0];
    const competitorName = competitor?.name ?? "Competitor A";
    const provider = "mock" as const;
    const model = this.options.modelOverride ?? "mock-ai-visibility-model";

    const brandNotMentioned =
      lower.includes("brand not mentioned") || lower.includes("not mentioned");
    const negative =
      lower.includes("negative sentiment") || lower.includes("negative");
    const wrong =
      lower.includes("wrong brand description") || lower.includes("wrong");
    const competitorMentioned =
      lower.includes("competitor mentioned") || lower.includes("competitor");
    const ownedCitation =
      lower.includes("owned domain cited") || lower.includes("owned");
    const thirdPartyCitation =
      lower.includes("third party cited") || lower.includes("third");

    const citations: AiCitation[] = [];
    if (ownedCitation || !thirdPartyCitation) {
      citations.push({
        url: `https://${input.brandDomain}/about`,
        title: `${input.brandName} about page`,
        domain: input.brandDomain,
      });
    }
    if (thirdPartyCitation || competitorMentioned) {
      citations.push({
        url: "https://example-review-site.test/ai-visibility-market",
        title: "AI visibility market overview",
        domain: "example-review-site.test",
      });
    }

    const rawText = brandNotMentioned
      ? [
          `1. ${competitorName} is often recommended for this buyer need.`,
          "The tested brand is not clearly surfaced in this answer.",
          thirdPartyCitation ? "Source: example-review-site.test" : "",
        ].join("\n")
      : [
          competitorMentioned
            ? `1. ${competitorName} is a known alternative.`
            : "",
          `2. ${input.brandName} is ${negative ? "mentioned with concerns about clarity" : "a strong option"} for the prompt "${input.prompt}".`,
          wrong
            ? `${input.brandName} appears to be described as a consumer app, which may be inaccurate.`
            : "",
          ownedCitation ? `The answer cites ${input.brandDomain}.` : "",
          thirdPartyCitation
            ? "The answer also cites a third-party market overview."
            : "",
        ]
          .filter(Boolean)
          .join("\n");

    return {
      provider,
      model,
      rawText,
      rawJson: {
        provider,
        scenario: {
          brandNotMentioned,
          competitorMentioned,
          ownedCitation,
          thirdPartyCitation,
          negative,
          wrong,
        },
        rawText,
      },
      citations,
      inputTokens: input.prompt.length,
      outputTokens: rawText.length,
    };
  }
}

function extractOpenAiText(rawJson: any): string {
  if (typeof rawJson?.output_text === "string") return rawJson.output_text;
  return extractTextBlocks(rawJson).join("\n").trim();
}

function extractGeminiText(rawJson: any): string {
  return (
    rawJson?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text)
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

function extractAnthropicText(rawJson: any): string {
  return (
    rawJson?.content
      ?.filter(
        (block: any) => block.type === "text" && typeof block.text === "string",
      )
      .map((block: any) => block.text)
      .join("\n") ?? ""
  );
}

function extractOpenAiCitations(rawJson: any): AiCitation[] {
  const citations: AiCitation[] = [];
  walk(rawJson, (value) => {
    if (value?.type === "url_citation" && value.url) {
      citations.push({
        url: value.url,
        title: value.title,
        domain: domainFromUrl(value.url),
      });
    }
    if (value?.url && value?.type === "source") {
      citations.push({
        url: value.url,
        title: value.title,
        domain: domainFromUrl(value.url),
      });
    }
  });
  return dedupeCitations(citations);
}

function extractGeminiCitations(rawJson: any): AiCitation[] {
  const chunks =
    rawJson?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return dedupeCitations(
    chunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web?.uri)
      .map((web: any) => ({
        url: web.uri,
        title: web.title,
        domain: domainFromUrl(web.uri),
      })),
  );
}

function extractAnthropicCitations(rawJson: any): AiCitation[] {
  const citations: AiCitation[] = [];
  walk(rawJson, (value) => {
    if (value?.type === "web_search_result" && value.url) {
      citations.push({
        url: value.url,
        title: value.title,
        domain: domainFromUrl(value.url),
      });
    }
    if (value?.type === "web_search_result_location" && value.url) {
      citations.push({
        url: value.url,
        title: value.title,
        domain: domainFromUrl(value.url),
      });
    }
  });
  return dedupeCitations(citations);
}

function extractTextBlocks(rawJson: any): string[] {
  const blocks: string[] = [];
  walk(rawJson, (value) => {
    if (typeof value?.text === "string") blocks.push(value.text);
  });
  return blocks;
}

function walk(value: unknown, visitor: (value: any) => void) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  for (const item of Object.values(value)) walk(item, visitor);
}

function dedupeCitations(citations: AiCitation[]): AiCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    if (seen.has(citation.url)) return false;
    seen.add(citation.url);
    return true;
  });
}
