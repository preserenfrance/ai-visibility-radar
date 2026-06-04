import type { ScoreBreakdown } from "@ai-radar/shared";

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
        `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.description)}</li>`
    )
    .join("");
  const losingPrompts = input.losingPrompts
    .slice(0, 3)
    .map((prompt) => `<li>${escapeHtml(prompt)}</li>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <h1>AI Visibility Score za ${escapeHtml(input.domain)} je ${input.score.visibilityScore}/100</h1>
    <p>${escapeHtml(input.brandName)} je bil ocenjen prek ponovljivih testnih promptov, ne kot absolutna resnica.</p>
    <ul>
      <li>Mention rate: ${input.score.mentionScore}/100</li>
      <li>Average rank: ${input.score.rankScore}/100</li>
      <li>Citation score: ${input.score.citationScore}/100</li>
      <li>Accuracy score: ${input.score.accuracyScore}/100</li>
    </ul>
    <p>Top competitor: ${escapeHtml(input.topCompetitor ?? "ni dovolj podatkov")}</p>
    <h2>Prompti, kjer brand izgublja</h2>
    <ol>${losingPrompts || "<li>Ni dovolj podatkov.</li>"}</ol>
    <h2>Priporočila</h2>
    <ol>${recommendations || "<li>Zaženi celoten scan za podrobnejša priporočila.</li>"}</ol>
    <p><a href="${escapeHtml(input.reportUrl)}">Odpri report</a></p>
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
    `Hi, we ran a quick AI visibility audit for ${input.domain}. Your score is ${input.score.visibilityScore}/100, and the clearest opportunity is improving the pages and sources AI assistants rely on when recommending vendors. I can show you the prompts where competitors appear ahead of you and the concrete actions to improve repeatable visibility.`
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
