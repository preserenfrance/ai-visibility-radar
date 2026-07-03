import { getConfig } from "@ai-radar/config";
import {
  generateAuditReportHtml,
  type AuditReportInput,
} from "@ai-radar/reports";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type ScanCompletedEmailInput = {
  to: string;
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
};

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ id?: string; skipped?: boolean }> {
  const config = getConfig();
  if (!config.RESEND_API_KEY) {
    return {
      id: `dev-${Date.now()}`,
      skipped: true,
    };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(config.RESEND_API_KEY);
  const response = await resend.emails.send({
    from:
      config.RESEND_FROM_EMAIL ?? "AI Visibility Radar <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return { id: response.data?.id };
}

export async function sendWelcomeEmail(input: {
  to: string;
  name?: string | null;
  appUrl?: string;
}): Promise<{ id?: string; skipped?: boolean }> {
  const appUrl = input.appUrl ?? getConfig().NEXT_PUBLIC_APP_URL;
  const dashboardUrl = absoluteUrl(appUrl, "/app/dashboard");
  const greeting = input.name
    ? `Pozdravljeni, ${escapeHtml(input.name)}!`
    : "Pozdravljeni!";

  return sendEmail({
    to: input.to,
    subject: "Dobrodošli v AI Visibility Radar",
    html: renderEmailLayout({
      preheader: "Račun je pripravljen. Lahko začnete z merjenjem AI vidnosti.",
      title: "Dobrodošli v AI Visibility Radar",
      bodyHtml: [
        `<p>${greeting}</p>`,
        "<p>Vaš račun je pripravljen. V aplikaciji lahko dodate znamko, uredite prompte in zaženete prvi AI visibility scan.</p>",
        "<p>Ko bo scan zaključen, vam bomo poslali tudi povzetek rezultata.</p>",
      ].join(""),
      cta: {
        label: "Odpri nadzorno ploščo",
        url: dashboardUrl,
      },
    }),
    text: [
      "Dobrodošli v AI Visibility Radar.",
      "Vaš račun je pripravljen.",
      `Odprite nadzorno ploščo: ${dashboardUrl}`,
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<{ id?: string; skipped?: boolean }> {
  const expiresInMinutes = input.expiresInMinutes ?? 60;

  return sendEmail({
    to: input.to,
    subject: "Ponastavitev gesla za AI Visibility Radar",
    html: renderEmailLayout({
      preheader: "Prejeli smo zahtevo za ponastavitev gesla.",
      title: "Ponastavitev gesla",
      bodyHtml: [
        "<p>Pozdravljeni,</p>",
        "<p>Prejeli smo zahtevo za ponastavitev gesla za vaš AI Visibility Radar račun.</p>",
        `<p>Povezava velja ${expiresInMinutes} minut. Če zahteve niste oddali vi, lahko to sporočilo ignorirate.</p>`,
      ].join(""),
      cta: {
        label: "Nastavi novo geslo",
        url: input.resetUrl,
      },
    }),
    text: [
      "Prejeli smo zahtevo za ponastavitev gesla.",
      `Povezava velja ${expiresInMinutes} minut.`,
      `Nastavite novo geslo: ${input.resetUrl}`,
      "Če zahteve niste oddali vi, lahko to sporočilo ignorirate.",
    ].join("\n"),
  });
}

export async function sendScanCompletedEmail(
  input: ScanCompletedEmailInput,
): Promise<{ id?: string; skipped?: boolean }> {
  const appUrl = input.appUrl ?? getConfig().NEXT_PUBLIC_APP_URL;
  const scanUrl = absoluteUrl(
    appUrl,
    `/app/brands/${input.brandId}/scans/${input.scanRunId}`,
  );
  const dashboardUrl = absoluteUrl(appUrl, `/app/brands/${input.brandId}`);
  const triggerLabel =
    input.triggerType === "scheduled" ? "samodejni" : "ročni";
  const finishedAt = input.finishedAt
    ? formatDateTime(input.finishedAt)
    : undefined;

  return sendEmail({
    to: input.to,
    subject: `AI scan za ${input.brandName} je zaključen (${input.visibilityScore}/100)`,
    html: renderEmailLayout({
      preheader: `Zaključen je ${triggerLabel} scan za ${input.brandName}.`,
      title: `Scan je zaključen`,
      bodyHtml: [
        `<p>${input.recipientName ? `Pozdravljeni, ${escapeHtml(input.recipientName)}!` : "Pozdravljeni!"}</p>`,
        `<p>Zaključen je ${triggerLabel} AI visibility scan za <strong>${escapeHtml(input.brandName)}</strong> (${escapeHtml(input.brandDomain)}).</p>`,
        renderMetricTable([
          ["Visibility score", `${input.visibilityScore}/100`],
          [
            "Uspešni prompti",
            `${input.completedPromptRuns}/${input.totalPromptRuns}`,
          ],
          ["Neuspešni prompti", String(input.failedPromptRuns)],
          ...(finishedAt
            ? [["Zaključeno", finishedAt] as [string, string]]
            : []),
        ]),
        "<p>Podrobnosti scana, odgovore modelov, citate in priporočila najdete v aplikaciji.</p>",
      ].join(""),
      cta: {
        label: "Odpri rezultat scana",
        url: scanUrl,
      },
      secondaryUrl: dashboardUrl,
    }),
    text: [
      `Zaključen je ${triggerLabel} AI visibility scan za ${input.brandName} (${input.brandDomain}).`,
      `Visibility score: ${input.visibilityScore}/100`,
      `Uspešni prompti: ${input.completedPromptRuns}/${input.totalPromptRuns}`,
      `Neuspešni prompti: ${input.failedPromptRuns}`,
      finishedAt ? `Zaključeno: ${finishedAt}` : "",
      `Rezultat scana: ${scanUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendAuditReportEmail(
  to: string,
  report: AuditReportInput,
): Promise<{ id?: string; skipped?: boolean }> {
  return sendEmail({
    to,
    subject: `Tvoj AI Visibility Score za ${report.domain} je ${report.score.visibilityScore}/100`,
    html: generateAuditReportHtml(report),
  });
}

function absoluteUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function renderEmailLayout(input: {
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: {
    label: string;
    url: string;
  };
  secondaryUrl?: string;
}) {
  const ctaHtml = input.cta
    ? `<p style="margin:28px 0 20px;"><a href="${escapeAttribute(input.cta.url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700;">${escapeHtml(input.cta.label)}</a></p>`
    : "";
  const secondaryHtml = input.secondaryUrl
    ? `<p style="margin:0;color:#6b7280;font-size:13px;">Nadzorna plošča: <a href="${escapeAttribute(input.secondaryUrl)}" style="color:#2563eb;">${escapeHtml(input.secondaryUrl)}</a></p>`
    : "";

  return [
    "<!doctype html>",
    '<html lang="sl">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(input.title)}</title>`,
    "</head>",
    '<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:28px 12px;">',
    "<tr>",
    '<td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">',
    "<tr>",
    '<td style="padding:28px 28px 24px;">',
    '<p style="margin:0 0 12px;color:#6b7280;font-size:13px;font-weight:700;letter-spacing:0;text-transform:uppercase;">AI Visibility Radar</p>',
    `<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#111827;">${escapeHtml(input.title)}</h1>`,
    `<div style="font-size:15px;line-height:1.65;color:#374151;">${input.bodyHtml}</div>`,
    ctaHtml,
    secondaryHtml,
    "</td>",
    "</tr>",
    "</table>",
    '<p style="max-width:620px;margin:16px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">To sporočilo ste prejeli, ker uporabljate AI Visibility Radar.</p>',
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
        `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${escapeHtml(label)}</td><td align="right" style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">${rowHtml}</table>`;
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("sl-SI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
