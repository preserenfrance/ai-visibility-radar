import { unstable_cache } from "next/cache";
import { prisma } from "@ai-radar/db";

const FAQ_SETTINGS_KEY = "faq_content_en";
export const FAQ_CACHE_TAG = "public-faq";

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqSection = {
  title: string;
  items: FaqItem[];
};

export const DEFAULT_FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Basics",
    items: [
      {
        question: "What is AI Visibility Radar for?",
        answer:
          "It is built for companies that want to know whether AI assistants such as ChatGPT, Gemini and Claude mention or recommend them for the questions potential buyers actually ask. Instead of measuring only Google rankings, it measures brand visibility inside AI answers.",
      },
      {
        question: "How does the tool work?",
        answer:
          "You enter a brand, website, competitors and buyer questions. Radar sends those questions to selected AI models, stores the answers, checks brand and competitor mentions, calculates metrics and shows where the brand is visible and where it is losing opportunities.",
      },
      {
        question: "What is a question or prompt?",
        answer:
          "A prompt is the question a buyer asks an AI assistant. A good question is concrete and purchase-oriented, for example: Where can I buy quality garden furniture with delivery?",
      },
      {
        question: "Do I have to enter all 5 questions in the first audit?",
        answer:
          "No. The first free audit needs at least 3 questions and supports up to 5. After you create a brand in the app, the free plan supports up to 10 active questions or prompts per brand, while paid plans have higher limits.",
      },
    ],
  },
  {
    title: "Models and scans",
    items: [
      {
        question: "Which AI models do you use?",
        answer:
          "The tool supports ChatGPT, Gemini, Claude and search-enabled models that can also collect sources and citations. All views are available on every plan; plans differ by the number of active questions and manual scans.",
      },
      {
        question: "What is the difference between standard models and search models?",
        answer:
          "Standard models answer from model knowledge. Search-enabled models browse the web while answering and often return sources, so you can see which domains AI uses as evidence or recommendations.",
      },
      {
        question: "What does a recurring scan mean?",
        answer:
          "A recurring scan automatically repeats the measurement for your brand. Automatic weekly scans are included in every plan, including the free plan.",
      },
      {
        question: "Why are results different between models?",
        answer:
          "Each model answers differently, has different access to fresh information and understands markets differently. Tracking multiple models helps you understand real AI visibility more accurately.",
      },
    ],
  },
  {
    title: "Metrics and results",
    items: [
      {
        question: "What does visibility mean?",
        answer:
          "Visibility is the overall score for a brand's AI presence. It combines mentions, rank, citations, share of voice and accuracy. A higher score means the brand appears more often and more strongly in AI answers.",
      },
      {
        question: "What do mentions mean?",
        answer:
          "Mentions show how often AI models mention your brand in their answers. If the brand is not mentioned, a buyer probably will not reach you through that AI answer.",
      },
      {
        question: "What is share of voice?",
        answer:
          "Share of voice compares your brand mentions with competitor mentions. It helps you understand whether AI models recommend you or other providers more often.",
      },
      {
        question: "What does accuracy mean?",
        answer:
          "Accuracy measures whether statements about your brand are correct and reliable. Being mentioned is not enough; AI should also avoid outdated or incorrect claims about you.",
      },
      {
        question: "What are citations?",
        answer:
          "Citations are sources used by search-enabled models in an answer. The citations table shows which domains support your brand, which support competitors and which sources may be worth strengthening.",
      },
      {
        question: "What is the ChatGPT brand view?",
        answer:
          "It is a short AI summary of the public picture of your brand. It shows how ChatGPT understands the brand, which products or services stand out and which public objections may repeat among dissatisfied customers.",
      },
    ],
  },
  {
    title: "Plans and pricing",
    items: [
      {
        question: "How much does the tool cost?",
        answer:
          "The free plan includes one brand, up to 10 active questions and a weekly automatic scan. Starter costs EUR 15.99 per month and includes more questions plus 4 manual scans per month. Growth costs EUR 39.99 per month and includes additional brands, more questions and 15 manual scans per month.",
      },
      {
        question: "What do I get in the free plan?",
        answer:
          "The free plan includes one brand, up to 10 active questions, a weekly automatic scan and access to all tabs and views. Manual scans are part of the paid plans.",
      },
      {
        question: "When do I need a paid plan?",
        answer:
          "You need a paid plan when you want more active questions or manual scan runs. Starter is for one brand, while Growth supports more brands and higher limits.",
      },
      {
        question: "Can I change the plan later?",
        answer:
          "Yes. In settings you can open the billing portal and manage the subscription. If the subscription is not active, the organization returns to free limits and manual scans from paid plans are no longer available.",
      },
    ],
  },
  {
    title: "Practical use",
    items: [
      {
        question: "What questions should I enter?",
        answer:
          "The best prompts are concrete buyer questions: what to buy, where to buy, which provider is a good choice, which store has a specific product, or which product fits a specific problem. Questions that already include your brand are less useful because they make the measurement less realistic.",
      },
      {
        question: "What should I do if AI does not mention me?",
        answer:
          "First look at which competitors are mentioned and which sources are cited. Then improve website content, add clear product information, comparison pages, category guides, proof, reviews, FAQ content and sources AI can understand and cite.",
      },
      {
        question: "Does the tool fix my website automatically?",
        answer:
          "No. The tool shows where you are losing visibility and what is worth improving. Website, content, category and external source changes remain with you or your team.",
      },
      {
        question: "Who benefits most from the tool?",
        answer:
          "It is most useful for online stores, B2B companies, local providers, SaaS companies and any business where buyers research through AI assistants before purchase.",
      },
      {
        question: "Do results guarantee that AI will always recommend me?",
        answer:
          "No. AI answers change by model, time, question and available sources. Radar measures repeatable patterns and trends, not absolute guarantees. The value is in ongoing monitoring and improving the signals models use.",
      },
    ],
  },
];

export async function faqSections() {
  if (!process.env.DATABASE_URL) return DEFAULT_FAQ_SECTIONS;

  const saved = await prisma.systemPrompt
    .findUnique({ where: { key: FAQ_SETTINGS_KEY } })
    .catch(() => null);
  if (!saved?.content) return DEFAULT_FAQ_SECTIONS;
  return parseFaqSections(saved.content);
}

export const cachedFaqSections = unstable_cache(
  faqSections,
  ["public-faq-sections"],
  {
    revalidate: 300,
    tags: [FAQ_CACHE_TAG],
  },
);

export async function saveFaqSections(
  sections: FaqSection[],
  updatedByEmail?: string,
) {
  const content = JSON.stringify(normalizeFaqSections(sections), null, 2);
  return prisma.systemPrompt.upsert({
    where: { key: FAQ_SETTINGS_KEY },
    update: {
      title: "FAQ content",
      description: "Editable content for the public FAQ page.",
      content,
      defaultContent: JSON.stringify(DEFAULT_FAQ_SECTIONS, null, 2),
      updatedByEmail,
    },
    create: {
      key: FAQ_SETTINGS_KEY,
      title: "FAQ content",
      description: "Editable content for the public FAQ page.",
      content,
      defaultContent: JSON.stringify(DEFAULT_FAQ_SECTIONS, null, 2),
      updatedByEmail,
    },
  });
}

export async function resetFaqSections(updatedByEmail?: string) {
  return saveFaqSections(DEFAULT_FAQ_SECTIONS, updatedByEmail);
}

function parseFaqSections(content: string): FaqSection[] {
  try {
    return normalizeFaqSections(JSON.parse(content));
  } catch {
    return DEFAULT_FAQ_SECTIONS;
  }
}

export function normalizeFaqSections(value: unknown): FaqSection[] {
  if (!Array.isArray(value)) return DEFAULT_FAQ_SECTIONS;
  const sections = value
    .map((section) => {
      const candidate = section as { title?: unknown; items?: unknown };
      const title =
        typeof candidate.title === "string" ? candidate.title.trim() : "";
      const items = Array.isArray(candidate.items)
        ? candidate.items
            .map((item) => {
              const itemCandidate = item as {
                question?: unknown;
                answer?: unknown;
              };
              return {
                question:
                  typeof itemCandidate.question === "string"
                    ? itemCandidate.question.trim()
                    : "",
                answer:
                  typeof itemCandidate.answer === "string"
                    ? itemCandidate.answer.trim()
                    : "",
              };
            })
            .filter((item) => item.question && item.answer)
        : [];

      return { title, items };
    })
    .filter((section) => section.title && section.items.length > 0);

  return sections.length ? sections : DEFAULT_FAQ_SECTIONS;
}
