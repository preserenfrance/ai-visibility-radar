import { getConfig } from "@ai-radar/config";
import {
  generateAuditReportHtml,
  type AuditReportInput,
} from "@ai-radar/reports";

type EmailLocale = "sl" | "en";

const EMAIL_COPY: Record<
  EmailLocale,
  {
    greeting: (name?: string | null) => string;
    welcome: {
      subject: string;
      preheader: string;
      title: string;
      body: string[];
      cta: string;
      text: string[];
      preferences: string;
    };
    passwordReset: {
      subject: string;
      preheader: string;
      title: string;
      body: (minutes: number) => string[];
      cta: string;
      text: (minutes: number, resetUrl: string) => string[];
    };
    scanCompleted: {
      trigger: Record<"manual" | "scheduled", string>;
      subject: (brandName: string, score: number) => string;
      preheader: (trigger: string, brandName: string) => string;
      title: string;
      intro: (trigger: string, brandName: string, domain: string) => string;
      metrics: {
        score: string;
        completed: string;
        failed: string;
        finished: string;
      };
      details: string;
      cta: string;
      text: {
        score: string;
        completed: string;
        failed: string;
        finished: string;
        result: string;
        unsubscribe: string;
      };
    };
    layout: {
      dashboard: string;
      footer: string;
      unsubscribe: string;
    };
  }
> = {
  sl: {
    greeting: (name) =>
      name ? `Pozdravljeni, ${escapeHtml(name)}!` : "Pozdravljeni!",
    welcome: {
      subject: "Dobrodošli v AI Visibility Radar",
      preheader: "Račun je pripravljen. Lahko začnete z merjenjem AI vidnosti.",
      title: "Dobrodošli v AI Visibility Radar",
      body: [
        "Vaš račun je pripravljen. V aplikaciji lahko dodate znamko, uredite prompte in zaženete prvi AI visibility scan.",
        "E-mail obvestila lahko kadarkoli uredite prek povezave na dnu sporočila.",
      ],
      cta: "Odpri nadzorno ploščo",
      text: ["Dobrodošli v AI Visibility Radar.", "Vaš račun je pripravljen."],
      preferences: "Nastavitve e-mail obvestil",
    },
    passwordReset: {
      subject: "Ponastavitev gesla za AI Visibility Radar",
      preheader: "Prejeli smo zahtevo za ponastavitev gesla.",
      title: "Ponastavitev gesla",
      body: (minutes) => [
        "Prejeli smo zahtevo za ponastavitev gesla za vaš AI Visibility Radar račun.",
        `Povezava velja ${minutes} minut. Če zahteve niste oddali vi, lahko to sporočilo ignorirate.`,
      ],
      cta: "Nastavi novo geslo",
      text: (minutes, resetUrl) => [
        "Prejeli smo zahtevo za ponastavitev gesla.",
        `Povezava velja ${minutes} minut.`,
        `Nastavite novo geslo: ${resetUrl}`,
        "Če zahteve niste oddali vi, lahko to sporočilo ignorirate.",
      ],
    },
    scanCompleted: {
      trigger: { manual: "ročni", scheduled: "samodejni" },
      subject: (brandName, score) =>
        `AI scan za ${brandName} je zaključen (${score}/100)`,
      preheader: (trigger, brandName) =>
        `Zaključen je ${trigger} scan za ${brandName}.`,
      title: "Scan je zaključen",
      intro: (trigger, brandName, domain) =>
        `Zaključen je ${trigger} AI visibility scan za <strong>${escapeHtml(brandName)}</strong> (${escapeHtml(domain)}).`,
      metrics: {
        score: "Visibility score",
        completed: "Uspešni prompti",
        failed: "Neuspešni prompti",
        finished: "Zaključeno",
      },
      details:
        "Podrobnosti scana, odgovore modelov, citate in priporočila najdete v aplikaciji.",
      cta: "Odpri rezultat scana",
      text: {
        score: "Visibility score",
        completed: "Uspešni prompti",
        failed: "Neuspešni prompti",
        finished: "Zaključeno",
        result: "Rezultat scana",
        unsubscribe: "Odjava od scan obvestil",
      },
    },
    layout: {
      dashboard: "Nadzorna plošča",
      footer: "To sporočilo ste prejeli, ker uporabljate AI Visibility Radar.",
      unsubscribe: "Upravljanje e-mail obvestil in odjava",
    },
  },
  en: {
    greeting: (name) => (name ? `Hello, ${escapeHtml(name)}!` : "Hello!"),
    welcome: {
      subject: "Welcome to AI Visibility Radar",
      preheader:
        "Your account is ready. You can start measuring AI visibility.",
      title: "Welcome to AI Visibility Radar",
      body: [
        "Your account is ready. In the app you can add a brand, edit prompts and run your first AI visibility scan.",
        "You can change email notification settings at any time through the link at the bottom of this message.",
      ],
      cta: "Open dashboard",
      text: ["Welcome to AI Visibility Radar.", "Your account is ready."],
      preferences: "Email notification settings",
    },
    passwordReset: {
      subject: "Reset your AI Visibility Radar password",
      preheader: "We received a password reset request.",
      title: "Password reset",
      body: (minutes) => [
        "We received a password reset request for your AI Visibility Radar account.",
        `The link is valid for ${minutes} minutes. If you did not request this, you can ignore this message.`,
      ],
      cta: "Set a new password",
      text: (minutes, resetUrl) => [
        "We received a password reset request.",
        `The link is valid for ${minutes} minutes.`,
        `Set a new password: ${resetUrl}`,
        "If you did not request this, you can ignore this message.",
      ],
    },
    scanCompleted: {
      trigger: { manual: "manual", scheduled: "scheduled" },
      subject: (brandName, score) =>
        `AI scan for ${brandName} is complete (${score}/100)`,
      preheader: (trigger, brandName) =>
        `The ${trigger} scan for ${brandName} is complete.`,
      title: "Scan complete",
      intro: (trigger, brandName, domain) =>
        `The ${trigger} AI visibility scan for <strong>${escapeHtml(brandName)}</strong> (${escapeHtml(domain)}) is complete.`,
      metrics: {
        score: "Visibility score",
        completed: "Completed prompts",
        failed: "Failed prompts",
        finished: "Completed at",
      },
      details:
        "You can find scan details, model answers, citations and recommendations in the app.",
      cta: "Open scan result",
      text: {
        score: "Visibility score",
        completed: "Completed prompts",
        failed: "Failed prompts",
        finished: "Completed at",
        result: "Scan result",
        unsubscribe: "Unsubscribe from scan notifications",
      },
    },
    layout: {
      dashboard: "Dashboard",
      footer: "You received this message because you use AI Visibility Radar.",
      unsubscribe: "Manage email notifications and unsubscribe",
    },
  },
};

const BRAND_COLORS = {
  background: "#F9FAFB",
  foreground: "#0F1729",
  primary: "#158479",
  primaryDark: "#0F5F58",
  secondary: "#E3EAF2",
  muted: "#566376",
  accent: "#F6A728",
  border: "#C5D0DD",
  card: "#FFFFFF",
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type ScanCompletedEmailInput = {
  to: string;
  locale?: string | null;
  recipientName?: string | null;
  brandName: string;
  brandDomain: string;
  brandId: string;
  scanRunId: string;
  triggerType: "manual" | "scheduled";
  visibilityScore: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
  totalPromptRuns: number;
  finishedAt?: Date | string | null;
  appUrl?: string;
  unsubscribeUrl?: string;
};

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ id?: string; skipped?: boolean; subject: string }> {
  const config = getConfig();
  if (!config.RESEND_API_KEY) {
    return {
      id: `dev-${Date.now()}`,
      skipped: true,
      subject: input.subject,
    };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(config.RESEND_API_KEY);
  const response = await resend.emails.send({
    from:
      config.RESEND_FROM_EMAIL ??
      "AI Visibility Radar <notifications@llmvisio.com>",
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return { id: response.data?.id, subject: input.subject };
}

export async function sendWelcomeEmail(input: {
  to: string;
  locale?: string | null;
  name?: string | null;
  appUrl?: string;
  preferencesUrl?: string;
}): Promise<{ id?: string; skipped?: boolean; subject: string }> {
  const locale = normalizeEmailLocale(input.locale);
  const copy = EMAIL_COPY[locale];
  const appUrl = input.appUrl ?? getConfig().NEXT_PUBLIC_APP_URL;
  const dashboardUrl = absoluteUrl(appUrl, "/app/dashboard");

  return sendEmail({
    to: input.to,
    subject: copy.welcome.subject,
    html: renderEmailLayout({
      locale,
      preheader: copy.welcome.preheader,
      title: copy.welcome.title,
      bodyHtml: [
        `<p>${copy.greeting(input.name)}</p>`,
        ...copy.welcome.body.map((paragraph) => `<p>${paragraph}</p>`),
      ].join(""),
      cta: {
        label: copy.welcome.cta,
        url: dashboardUrl,
      },
      unsubscribeUrl: input.preferencesUrl,
    }),
    text: [
      ...copy.welcome.text,
      `${copy.welcome.cta}: ${dashboardUrl}`,
      input.preferencesUrl
        ? `${copy.welcome.preferences}: ${input.preferencesUrl}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  locale?: string | null;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<{ id?: string; skipped?: boolean; subject: string }> {
  const locale = normalizeEmailLocale(input.locale);
  const copy = EMAIL_COPY[locale];
  const expiresInMinutes = input.expiresInMinutes ?? 60;

  return sendEmail({
    to: input.to,
    subject: copy.passwordReset.subject,
    html: renderEmailLayout({
      locale,
      preheader: copy.passwordReset.preheader,
      title: copy.passwordReset.title,
      bodyHtml: [
        `<p>${copy.greeting()}</p>`,
        ...copy.passwordReset
          .body(expiresInMinutes)
          .map((paragraph) => `<p>${paragraph}</p>`),
      ].join(""),
      cta: {
        label: copy.passwordReset.cta,
        url: input.resetUrl,
      },
    }),
    text: copy.passwordReset.text(expiresInMinutes, input.resetUrl).join("\n"),
  });
}

export async function sendScanCompletedEmail(
  input: ScanCompletedEmailInput,
): Promise<{ id?: string; skipped?: boolean; subject: string }> {
  const locale = normalizeEmailLocale(input.locale);
  const copy = EMAIL_COPY[locale];
  const appUrl = input.appUrl ?? getConfig().NEXT_PUBLIC_APP_URL;
  const scanUrl = absoluteUrl(
    appUrl,
    `/app/brands/${input.brandId}/scans/${input.scanRunId}`,
  );
  const dashboardUrl = absoluteUrl(appUrl, `/app/brands/${input.brandId}`);
  const triggerLabel = copy.scanCompleted.trigger[input.triggerType];
  const finishedAt = input.finishedAt
    ? formatDateTime(input.finishedAt, locale)
    : undefined;

  return sendEmail({
    to: input.to,
    subject: copy.scanCompleted.subject(input.brandName, input.visibilityScore),
    html: renderEmailLayout({
      locale,
      preheader: copy.scanCompleted.preheader(triggerLabel, input.brandName),
      title: copy.scanCompleted.title,
      bodyHtml: [
        `<p>${copy.greeting(input.recipientName)}</p>`,
        `<p>${copy.scanCompleted.intro(triggerLabel, input.brandName, input.brandDomain)}</p>`,
        renderMetricTable([
          [copy.scanCompleted.metrics.score, `${input.visibilityScore}/100`],
          [
            copy.scanCompleted.metrics.completed,
            `${input.completedPromptRuns}/${input.totalPromptRuns}`,
          ],
          [copy.scanCompleted.metrics.failed, String(input.failedPromptRuns)],
          ...(finishedAt
            ? [
                [copy.scanCompleted.metrics.finished, finishedAt] as [
                  string,
                  string,
                ],
              ]
            : []),
        ]),
        `<p>${copy.scanCompleted.details}</p>`,
      ].join(""),
      cta: {
        label: copy.scanCompleted.cta,
        url: scanUrl,
      },
      secondaryUrl: dashboardUrl,
      unsubscribeUrl: input.unsubscribeUrl,
    }),
    text: [
      stripHtml(
        copy.scanCompleted.intro(
          triggerLabel,
          input.brandName,
          input.brandDomain,
        ),
      ),
      `${copy.scanCompleted.text.score}: ${input.visibilityScore}/100`,
      `${copy.scanCompleted.text.completed}: ${input.completedPromptRuns}/${input.totalPromptRuns}`,
      `${copy.scanCompleted.text.failed}: ${input.failedPromptRuns}`,
      finishedAt ? `${copy.scanCompleted.text.finished}: ${finishedAt}` : "",
      `${copy.scanCompleted.text.result}: ${scanUrl}`,
      input.unsubscribeUrl
        ? `${copy.scanCompleted.text.unsubscribe}: ${input.unsubscribeUrl}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendAuditReportEmail(
  to: string,
  report: AuditReportInput,
): Promise<{ id?: string; skipped?: boolean; subject: string }> {
  const locale = normalizeEmailLocale(report.locale);
  const subject =
    locale === "en"
      ? `Your AI Visibility Score for ${report.domain} is ${report.score.visibilityScore}/100`
      : `Tvoj AI Visibility Score za ${report.domain} je ${report.score.visibilityScore}/100`;

  return sendEmail({
    to,
    subject,
    html: generateAuditReportHtml(report),
  });
}

function absoluteUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function renderEmailLayout(input: {
  locale: EmailLocale;
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: {
    label: string;
    url: string;
  };
  secondaryUrl?: string;
  unsubscribeUrl?: string;
}) {
  const copy = EMAIL_COPY[input.locale];
  const ctaHtml = input.cta
    ? `<p style="margin:28px 0 20px;"><a href="${escapeAttribute(input.cta.url)}" style="display:inline-block;background:${BRAND_COLORS.primary};color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700;">${escapeHtml(input.cta.label)}</a></p>`
    : "";
  const secondaryHtml = input.secondaryUrl
    ? `<p style="margin:0;color:${BRAND_COLORS.muted};font-size:13px;">${copy.layout.dashboard}: <a href="${escapeAttribute(input.secondaryUrl)}" style="color:${BRAND_COLORS.primary};">${escapeHtml(input.secondaryUrl)}</a></p>`
    : "";
  const unsubscribeHtml = input.unsubscribeUrl
    ? ` <a href="${escapeAttribute(input.unsubscribeUrl)}" style="color:${BRAND_COLORS.primary};">${copy.layout.unsubscribe}</a>.`
    : "";

  return [
    "<!doctype html>",
    `<html lang="${input.locale}">`,
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(input.title)}</title>`,
    "</head>",
    `<body style="margin:0;background:${BRAND_COLORS.background};font-family:Cabin,Arial,Helvetica,sans-serif;color:${BRAND_COLORS.foreground};">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_COLORS.background};padding:28px 12px;">`,
    "<tr>",
    '<td align="center">',
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:${BRAND_COLORS.card};border:1px solid ${BRAND_COLORS.border};border-radius:10px;overflow:hidden;">`,
    "<tr>",
    `<td style="padding:20px 28px;background:${BRAND_COLORS.primary};color:#ffffff;">`,
    '<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;">LLM Visio</p>',
    '<p style="margin:0;font-size:18px;line-height:1.3;font-weight:700;">AI Visibility Radar</p>',
    `<div style="width:44px;height:3px;margin-top:14px;background:${BRAND_COLORS.accent};border-radius:999px;"></div>`,
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:28px 28px 24px;">',
    `<p style="margin:0 0 12px;color:${BRAND_COLORS.primary};font-size:13px;font-weight:700;letter-spacing:0;text-transform:uppercase;">AI Visibility Radar</p>`,
    `<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${BRAND_COLORS.foreground};">${escapeHtml(input.title)}</h1>`,
    `<div style="font-size:15px;line-height:1.65;color:${BRAND_COLORS.foreground};">${input.bodyHtml}</div>`,
    ctaHtml,
    secondaryHtml,
    "</td>",
    "</tr>",
    "</table>",
    `<p style="max-width:620px;margin:16px 0 0;color:${BRAND_COLORS.muted};font-size:12px;line-height:1.5;">${copy.layout.footer}${unsubscribeHtml}</p>`,
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

function renderMetricTable(rows: Array<[string, string]>) {
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 12px;border-bottom:1px solid ${BRAND_COLORS.border};color:${BRAND_COLORS.muted};">${escapeHtml(label)}</td><td align="right" style="padding:10px 12px;border-bottom:1px solid ${BRAND_COLORS.border};font-weight:700;color:${BRAND_COLORS.foreground};">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid ${BRAND_COLORS.border};border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">${rowHtml}</table>`;
}

function normalizeEmailLocale(value: unknown): EmailLocale {
  if (typeof value !== "string") return "sl";
  return value.trim().toLowerCase().startsWith("en") ? "en" : "sl";
}

function formatDateTime(value: Date | string, locale: EmailLocale) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "sl-SI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
