import type { ScoreBreakdown } from "@ai-radar/shared";

const BRAND_COLORS = {
  background: "#F9FAFB",
  foreground: "#0F1729",
  primary: "#158479",
  muted: "#566376",
  accent: "#F6A728",
  border: "#C5D0DD",
  card: "#FFFFFF",
};

export type AuditReportInput = {
  domain: string;
  brandName: string;
  score: ScoreBreakdown;
  topCompetitor?: string;
  losingPrompts: string[];
  recommendations: Array<{ title: string; description: string }>;
  reportUrl: string;
};

export function generateAuditReportHtml(input: AuditReportInput): string {
  const recommendations = input.recommendations
    .slice(0, 3)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.description)}</li>`,
    )
    .join("");
  const losingPrompts = input.losingPrompts
    .slice(0, 3)
    .map((prompt) => `<li>${escapeHtml(prompt)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="sl">
  <body style="margin:0;background:${BRAND_COLORS.background};font-family:Cabin,Arial,Helvetica,sans-serif;color:${BRAND_COLORS.foreground};line-height:1.5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_COLORS.background};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:${BRAND_COLORS.card};border:1px solid ${BRAND_COLORS.border};border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:20px 28px;background:${BRAND_COLORS.primary};color:#ffffff;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;">LLM Visio</p>
                <p style="margin:0;font-size:18px;line-height:1.3;font-weight:700;">AI Visibility Radar</p>
                <div style="width:44px;height:3px;margin-top:14px;background:${BRAND_COLORS.accent};border-radius:999px;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;color:${BRAND_COLORS.primary};font-size:13px;font-weight:700;text-transform:uppercase;">Brezplačen audit</p>
                <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${BRAND_COLORS.foreground};">AI Visibility Score za ${escapeHtml(input.domain)} je ${input.score.visibilityScore}/100</h1>
                <p style="margin:0 0 18px;color:${BRAND_COLORS.foreground};">${escapeHtml(input.brandName)} je bil ocenjen prek ponovljivih testnih promptov, ne kot absolutna resnica.</p>
                ${renderScoreTable(input.score)}
                <p style="margin:18px 0;color:${BRAND_COLORS.foreground};">Najmočnejši konkurent v tem pregledu: <strong>${escapeHtml(input.topCompetitor ?? "ni dovolj podatkov")}</strong></p>
                <h2 style="margin:24px 0 10px;font-size:17px;color:${BRAND_COLORS.foreground};">Prompti, kjer znamka izgublja</h2>
                <ol style="margin:0 0 18px;padding-left:22px;color:${BRAND_COLORS.foreground};">${losingPrompts || "<li>Ni dovolj podatkov.</li>"}</ol>
                <h2 style="margin:24px 0 10px;font-size:17px;color:${BRAND_COLORS.foreground};">Priporočila</h2>
                <ol style="margin:0 0 24px;padding-left:22px;color:${BRAND_COLORS.foreground};">${recommendations || "<li>Zaženi celoten scan za podrobnejša priporočila.</li>"}</ol>
                <p style="margin:28px 0 0;"><a href="${escapeHtml(input.reportUrl)}" style="display:inline-block;background:${BRAND_COLORS.primary};color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700;">Odpri report</a></p>
              </td>
            </tr>
          </table>
          <p style="max-width:620px;margin:16px 0 0;color:${BRAND_COLORS.muted};font-size:12px;line-height:1.5;">To sporočilo ste prejeli, ker ste zahtevali brezplačen AI visibility audit.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function generateSalesBrief(input: AuditReportInput): string {
  return [
    `Score: ${input.score.visibilityScore}/100 for ${input.domain}.`,
    `Largest problem: ${
      input.score.mentionScore < 40
        ? "The brand is rarely mentioned by AI assistants."
        : "The brand needs stronger citations and positioning."
    }`,
    `Winning competitor: ${input.topCompetitor ?? "No clear competitor winner yet."}`,
    `Losing prompts: ${input.losingPrompts.slice(0, 3).join(" | ") || "No prompt data yet."}`,
    `Recommendations: ${input.recommendations
      .slice(0, 3)
      .map((item) => item.title)
      .join(" | ")}`,
    "",
    "Suggested sales email:",
    `Subject: ${input.brandName} is leaving AI visibility on the table`,
    `Hi, we ran a quick AI visibility audit for ${input.domain}. Your score is ${input.score.visibilityScore}/100, and the clearest opportunity is improving the pages and sources AI assistants rely on when recommending vendors. I can show you the prompts where competitors appear ahead of you and the concrete actions to improve repeatable visibility.`,
  ].join("\n");
}

function renderScoreTable(score: ScoreBreakdown) {
  const rows: Array<[string, string]> = [
    ["Mention rate", `${score.mentionScore}/100`],
    ["Average rank", `${score.rankScore}/100`],
    ["Citation score", `${score.citationScore}/100`],
    ["Accuracy score", `${score.accuracyScore}/100`],
  ];
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 12px;border-bottom:1px solid ${BRAND_COLORS.border};color:${BRAND_COLORS.muted};">${escapeHtml(label)}</td><td align="right" style="padding:10px 12px;border-bottom:1px solid ${BRAND_COLORS.border};font-weight:700;color:${BRAND_COLORS.foreground};">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid ${BRAND_COLORS.border};border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">${rowHtml}</table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
