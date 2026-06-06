import { getConfig } from "@ai-radar/config";
import { generateAuditReportHtml, type AuditReportInput } from "@ai-radar/reports";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ id?: string; skipped?: boolean }> {
  const config = getConfig();
  if (!config.RESEND_API_KEY) {
    return {
      id: `dev-${Date.now()}`,
      skipped: true
    };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(config.RESEND_API_KEY);
  const response = await resend.emails.send({
    from: config.RESEND_FROM_EMAIL ?? "AI Visibility Radar <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    html: input.html
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return { id: response.data?.id };
}

export async function sendAuditReportEmail(
  to: string,
  report: AuditReportInput
): Promise<{ id?: string; skipped?: boolean }> {
  return sendEmail({
    to,
    subject: `Tvoj AI Visibility Score za ${report.domain} je ${report.score.visibilityScore}/100`,
    html: generateAuditReportHtml(report)
  });
}
