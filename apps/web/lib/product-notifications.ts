import {
  DEFAULT_LOCALE,
  type SupportedLocale,
  normalizeLocale,
} from "@ai-radar/shared";

type NotificationCopy = {
  title: string;
  body: string;
};

type ProductNotificationDefinition = {
  id: string;
  publishedAt: string;
  href?: string;
  copies: Record<SupportedLocale, NotificationCopy>;
};

const productNotifications: ProductNotificationDefinition[] = [
  {
    id: "2026-07-prompt-gap-generator",
    publishedAt: "2026-07-16T12:00:00.000Z",
    href: "/app/dashboard",
    copies: {
      sl: {
        title: "Prompt gap generator",
        body: "Na strani Prompti lahko zdaj ustvaris predloge za manjkajoca vprasanja glede na konkurente, citate in zadnje scane.",
      },
      en: {
        title: "Prompt gap generator",
        body: "On the Prompts page you can now generate missing buyer questions from competitors, citations and recent scans.",
      },
    },
  },
  {
    id: "2026-07-chatgpt-report-analysis",
    publishedAt: "2026-07-16T11:00:00.000Z",
    href: "/app/dashboard",
    copies: {
      sl: {
        title: "Analiza reporta v ChatGPT",
        body: "Pri brandu in posameznem scanu je dodan gumb Analiziraj v ChatGPT, ki odpre podpisan kontekst reporta.",
      },
      en: {
        title: "Analyze reports in ChatGPT",
        body: "Brand and scan reports now include an Analyze in ChatGPT button with signed report context.",
      },
    },
  },
  {
    id: "2026-07-ai-search-trace",
    publishedAt: "2026-07-15T10:00:00.000Z",
    href: "/app/dashboard",
    copies: {
      sl: {
        title: "AI search trace",
        body: "Pri odgovorih z iskanjem so vidni provider search queryji in viri, ki jih modeli uporabijo pri odgovoru.",
      },
      en: {
        title: "AI search trace",
        body: "Search-enabled model answers now show provider search queries and the sources used by the model.",
      },
    },
  },
  {
    id: "2026-07-branded-pdf-reports",
    publishedAt: "2026-07-14T09:00:00.000Z",
    href: "/app/dashboard",
    copies: {
      sl: {
        title: "Brandirani PDF reporti",
        body: "Iz pregleda branda ali scana lahko uporabnik prenese lep PDF report z metrikami, prompti in citati.",
      },
      en: {
        title: "Branded PDF reports",
        body: "Users can download polished PDF reports with metrics, prompts and citations from brand and scan pages.",
      },
    },
  },
];

export function productNotificationsForLocale(locale: unknown) {
  const normalizedLocale = normalizeLocale(locale);
  return productNotifications
    .map((notification) => ({
      id: notification.id,
      publishedAt: notification.publishedAt,
      href: notification.href,
      ...notification.copies[normalizedLocale],
    }))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function productNotificationIds() {
  return productNotifications.map((notification) => notification.id);
}

export function isProductNotificationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    productNotifications.some((notification) => notification.id === value)
  );
}

export function defaultNotificationLocale() {
  return DEFAULT_LOCALE;
}
