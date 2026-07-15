import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from "@ai-radar/shared";

type ScoreSnapshot = {
  visibilityScore: number;
  mentionScore: number;
  shareOfVoiceScore: number;
  accuracyScore: number;
  citationScore?: number | null;
  createdAt?: Date;
};

type ReportBrand = {
  name: string;
  domain: string;
  country?: string | null;
  language?: string | null;
  industry?: string | null;
  description?: string | null;
  chatGptBrandSummary?: string | null;
  chatGptCustomerConcernsSummary?: string | null;
  chatGptProductSummary?: string | null;
};

type ReportScan = {
  id: string;
  status: string;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  totalPromptRuns: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
  scoreSnapshot?: ScoreSnapshot | null;
  recommendations?: Array<{
    title: string;
    description: string;
    impactScore: number;
    effortScore: number;
  }>;
  promptRuns?: Array<ReportPromptRun>;
};

type ReportPromptRun = {
  status: string;
  errorMessage?: string | null;
  prompt: {
    text: string;
    category?: string | null;
    intent?: string | null;
  };
  engine: {
    engineName: string;
    provider?: string | null;
    searchEnabled?: boolean;
  };
  aiResponse?: {
    rawText: string;
    parsedResult?: {
      parsedJson: unknown;
    } | null;
    citations?: Array<{
      url: string;
      domain: string;
      title?: string | null;
      supportsBrand?: boolean;
      supportsCompetitor?: boolean;
      isOwnedDomain?: boolean;
      isCompetitorDomain?: boolean;
    }>;
    mentions?: Array<{
      entityName: string;
      entityType: string;
      rankPosition?: number | null;
    }>;
  } | null;
};

export type BrandPdfReportInput = {
  brand: ReportBrand;
  generatedAt: Date;
  locale?: SupportedLocale;
  latestScore?: ScoreSnapshot | null;
  scoreHistory: ScoreSnapshot[];
  competitors: Array<{ name: string; domain?: string | null }>;
  activePromptCount: number;
  latestScans: ReportScan[];
};

export type ScanPdfReportInput = {
  brand: ReportBrand;
  scan: ReportScan;
  generatedAt: Date;
  locale?: SupportedLocale;
};

type FontName = "F1" | "F2" | "F3";
type Color = [number, number, number];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_TOP = 84;
const CONTENT_BOTTOM = 790;
const LINE_CHART_HEIGHT = 154;
const LINE_CHART_REQUIRED_HEIGHT = LINE_CHART_HEIGHT + 22;
const KEY_VALUE_ROW_HEIGHT = 24;
const TABLE_ROW_HEIGHT = 24;

const COLORS = {
  ink: rgb(15, 23, 42),
  muted: rgb(100, 116, 139),
  line: rgb(226, 232, 240),
  primary: rgb(37, 99, 235),
  teal: rgb(15, 118, 110),
  emerald: rgb(5, 150, 105),
  amber: rgb(217, 119, 6),
  rose: rgb(220, 38, 38),
  slate: rgb(248, 250, 252),
  white: rgb(255, 255, 255),
};

type PdfCopy = {
  brandReportTitle: string;
  scanReportTitle: string;
  generatedLabel: string;
  pageLabel: string;
  generatedNote: (date: string) => string;
  visibilityChange: (previous: number, latest: number) => string;
  scanFact: (id: string) => string;
  startedFact: (date: string) => string;
  noAnswer: string;
  recommendationMeta: (impact: number, effort: number) => string;
  brandMentionUnknown: string;
  brandMentionYes: (rank: string) => string;
  brandMentionNo: string;
  citations: (value: string) => string;
  noCitations: string;
  metrics: {
    visibility: string;
    mentions: string;
    shareOfVoice: string;
    accuracy: string;
  };
  sections: {
    executiveScore: string;
    visibilityTrend: string;
    brandContext: string;
    latestScans: string;
    trackedCompetitors: string;
    scanScore: string;
    modelBreakdown: string;
    recommendedActions: string;
    promptFindings: string;
  };
  labels: {
    domain: string;
    industry: string;
    country: string;
    language: string;
    activePrompts: string;
    trackedCompetitors: string;
    started: string;
    status: string;
    visibility: string;
    runs: string;
    name: string;
    model: string;
    mentions: string;
    errors: string;
    finished: string;
    promptRuns: string;
  };
  statuses: Record<string, string>;
};

const PDF_COPY = {
  en: {
    brandReportTitle: "AI Visibility Report",
    scanReportTitle: "AI Scan Report",
    generatedLabel: "Generated",
    pageLabel: "Page",
    generatedNote: (date: string) =>
      `Generated ${date}. This report summarizes AI visibility, model answers, citations and practical signals captured in AI Visibility Radar.`,
    visibilityChange: (previous: number, latest: number) =>
      `Visibility changed from ${previous}/100 to ${latest}/100 across the latest two snapshots.`,
    scanFact: (id: string) => `Scan ${id}`,
    startedFact: (date: string) => `Started ${date}`,
    noAnswer: "No answer",
    recommendationMeta: (impact: number, effort: number) =>
      `Impact ${impact} / Effort ${effort}`,
    brandMentionUnknown: "Brand mention: unknown",
    brandMentionYes: (rank: string) => `Brand mention: yes, rank ${rank}`,
    brandMentionNo: "Brand mention: no",
    citations: (value: string) => `Citations: ${value}`,
    noCitations: "Citations: -",
    metrics: {
      visibility: "Visibility",
      mentions: "Mentions",
      shareOfVoice: "Share of voice",
      accuracy: "Accuracy",
    },
    sections: {
      executiveScore: "Executive score",
      visibilityTrend: "Visibility trend",
      brandContext: "Brand context",
      latestScans: "Latest scans",
      trackedCompetitors: "Tracked competitors",
      scanScore: "Scan score",
      modelBreakdown: "Model breakdown",
      recommendedActions: "Recommended actions",
      promptFindings: "Prompt findings",
    },
    labels: {
      domain: "Domain",
      industry: "Industry",
      country: "Country",
      language: "Language",
      activePrompts: "Active prompts",
      trackedCompetitors: "Tracked competitors",
      started: "Started",
      status: "Status",
      visibility: "Visibility",
      runs: "Runs",
      name: "Name",
      model: "Model",
      mentions: "Mentions",
      errors: "Errors",
      finished: "Finished",
      promptRuns: "Prompt runs",
    },
    statuses: {
      completed: "Completed",
      running: "Running",
      queued: "Queued",
      pending: "Pending",
      failed: "Failed",
      canceled: "Canceled",
      cancelled: "Canceled",
    },
  },
  sl: {
    brandReportTitle: "Porocilo o AI vidnosti",
    scanReportTitle: "Porocilo AI pregleda",
    generatedLabel: "Generirano",
    pageLabel: "Stran",
    generatedNote: (date: string) =>
      `Generirano ${date}. Porocilo povzema AI vidnost, odgovore modelov, citate in uporabne signale, zajete v AI Visibility Radar.`,
    visibilityChange: (previous: number, latest: number) =>
      `Vidnost se je med zadnjima dvema meritvama spremenila iz ${previous}/100 na ${latest}/100.`,
    scanFact: (id: string) => `Pregled ${id}`,
    startedFact: (date: string) => `Zaceto ${date}`,
    noAnswer: "Brez odgovora",
    recommendationMeta: (impact: number, effort: number) =>
      `Vpliv ${impact} / zahtevnost ${effort}`,
    brandMentionUnknown: "Omenba znamke: neznano",
    brandMentionYes: (rank: string) => `Omenba znamke: da, rang ${rank}`,
    brandMentionNo: "Omenba znamke: ne",
    citations: (value: string) => `Citati: ${value}`,
    noCitations: "Citati: -",
    metrics: {
      visibility: "Vidnost",
      mentions: "Omembe",
      shareOfVoice: "Delez glasu",
      accuracy: "Tocnost",
    },
    sections: {
      executiveScore: "Glavna ocena",
      visibilityTrend: "Trend vidnosti",
      brandContext: "Podatki o znamki",
      latestScans: "Zadnji pregledi",
      trackedCompetitors: "Spremljani konkurenti",
      scanScore: "Ocena pregleda",
      modelBreakdown: "Pregled po modelih",
      recommendedActions: "Priporoceni ukrepi",
      promptFindings: "Ugotovitve po promptih",
    },
    labels: {
      domain: "Domena",
      industry: "Industrija",
      country: "Drzava",
      language: "Jezik",
      activePrompts: "Aktivni prompti",
      trackedCompetitors: "Spremljani konkurenti",
      started: "Zaceto",
      status: "Stanje",
      visibility: "Vidnost",
      runs: "Izvedbe",
      name: "Ime",
      model: "Model",
      mentions: "Omembe",
      errors: "Napake",
      finished: "Zakljuceno",
      promptRuns: "Izvedbe promptov",
    },
    statuses: {
      completed: "Zakljucen",
      running: "V teku",
      queued: "V cakalni vrsti",
      pending: "V cakanju",
      failed: "Neuspesen",
      canceled: "Preklican",
      cancelled: "Preklican",
    },
  },
} satisfies Record<SupportedLocale, PdfCopy>;

export function buildBrandReportPdf(input: BrandPdfReportInput) {
  const locale = normalizeLocale(input.locale ?? DEFAULT_LOCALE);
  const copy = PDF_COPY[locale];
  const pdf = new PdfCanvas(
    "AI Visibility Radar",
    input.generatedAt,
    copy,
    locale,
  );
  const latest = input.latestScore;
  const previous = input.scoreHistory[1];

  pdf.cover(
    copy.brandReportTitle,
    input.brand.name,
    [
      input.brand.domain,
      input.brand.industry,
      input.brand.country,
      input.brand.language,
    ].filter(Boolean) as string[],
  );

  pdf.section(copy.sections.executiveScore, 196);
  pdf.metricGrid([
    metric(copy.metrics.visibility, latest?.visibilityScore),
    metric(copy.metrics.mentions, latest?.mentionScore),
    metric(copy.metrics.shareOfVoice, latest?.shareOfVoiceScore),
    metric(copy.metrics.accuracy, latest?.accuracyScore),
  ]);

  if (latest && previous) {
    pdf.note(
      copy.visibilityChange(previous.visibilityScore, latest.visibilityScore),
    );
  }

  if (input.scoreHistory.length > 0) {
    pdf.section(copy.sections.visibilityTrend, LINE_CHART_REQUIRED_HEIGHT);
    pdf.lineChart(
      [...input.scoreHistory].reverse().map((item) => ({
        label: item.createdAt ? shortDate(item.createdAt, locale) : "",
        value: item.visibilityScore,
      })),
    );
  }

  pdf.section(copy.sections.brandContext, KEY_VALUE_ROW_HEIGHT * 6 + 10);
  pdf.keyValues([
    [copy.labels.domain, input.brand.domain],
    [copy.labels.industry, input.brand.industry ?? "-"],
    [copy.labels.country, input.brand.country ?? "-"],
    [copy.labels.language, input.brand.language ?? "-"],
    [copy.labels.activePrompts, String(input.activePromptCount)],
    [copy.labels.trackedCompetitors, String(input.competitors.length)],
  ]);

  if (input.latestScans.length > 0) {
    pdf.section(copy.sections.latestScans, TABLE_ROW_HEIGHT * 2 + 10);
    pdf.table(
      [
        copy.labels.started,
        copy.labels.status,
        copy.labels.visibility,
        copy.labels.runs,
      ],
      input.latestScans.map((scan) => [
        formatDateTime(scan.createdAt, locale),
        formatStatus(scan.status, copy),
        scoreText(scan.scoreSnapshot?.visibilityScore),
        `${scan.completedPromptRuns}/${scan.totalPromptRuns}`,
      ]),
      [132, 88, 88, 88],
    );
  }

  if (input.competitors.length > 0) {
    pdf.section(copy.sections.trackedCompetitors, TABLE_ROW_HEIGHT * 2 + 10);
    pdf.table(
      [copy.labels.name, copy.labels.domain],
      input.competitors
        .slice(0, 12)
        .map((item) => [item.name, item.domain ?? "-"]),
      [220, 220],
    );
  }

  return pdf.toUint8Array();
}

export function buildScanReportPdf(input: ScanPdfReportInput) {
  const scan = input.scan;
  const score = scan.scoreSnapshot;
  const promptRuns = scan.promptRuns ?? [];
  const locale = normalizeLocale(input.locale ?? DEFAULT_LOCALE);
  const copy = PDF_COPY[locale];

  const pdf = new PdfCanvas(
    "AI Visibility Radar",
    input.generatedAt,
    copy,
    locale,
  );
  pdf.cover(copy.scanReportTitle, input.brand.name, [
    input.brand.domain,
    copy.scanFact(shortId(scan.id)),
    copy.startedFact(formatDateTime(scan.createdAt, locale)),
  ]);

  pdf.section(copy.sections.scanScore, 196);
  pdf.metricGrid([
    metric(copy.metrics.visibility, score?.visibilityScore),
    metric(copy.metrics.mentions, score?.mentionScore),
    metric(copy.metrics.shareOfVoice, score?.shareOfVoiceScore),
    metric(copy.metrics.accuracy, score?.accuracyScore),
  ]);

  pdf.keyValues([
    [copy.labels.status, formatStatus(scan.status, copy)],
    [
      copy.labels.started,
      scan.startedAt ? formatDateTime(scan.startedAt, locale) : "-",
    ],
    [
      copy.labels.finished,
      scan.finishedAt ? formatDateTime(scan.finishedAt, locale) : "-",
    ],
    [
      copy.labels.promptRuns,
      `${scan.completedPromptRuns}/${scan.totalPromptRuns}`,
    ],
    [copy.labels.errors, String(scan.failedPromptRuns)],
  ]);

  const breakdown = modelBreakdown(promptRuns);
  if (breakdown.length > 0) {
    pdf.section(copy.sections.modelBreakdown, TABLE_ROW_HEIGHT * 2 + 10);
    pdf.table(
      [
        copy.labels.model,
        copy.labels.runs,
        copy.labels.mentions,
        copy.labels.errors,
      ],
      breakdown.map((item) => [
        item.engine,
        String(item.total),
        String(item.mentioned),
        String(item.failed),
      ]),
      [190, 70, 80, 70],
    );
  }

  const recommendations = scan.recommendations ?? [];
  if (recommendations.length > 0) {
    pdf.section(copy.sections.recommendedActions, 90);
    for (const recommendation of recommendations.slice(0, 6)) {
      pdf.callout(
        recommendation.title,
        recommendation.description,
        copy.recommendationMeta(
          recommendation.impactScore,
          recommendation.effortScore,
        ),
      );
    }
  }

  pdf.section(copy.sections.promptFindings, 160);
  for (const run of promptRuns.slice(0, 12)) {
    const parsed = parsedResult(run);
    const answer = run.aiResponse?.rawText ?? run.errorMessage ?? copy.noAnswer;
    const citations = run.aiResponse?.citations ?? [];
    pdf.promptFinding({
      prompt: run.prompt.text,
      engine: run.engine.engineName,
      status: formatStatus(run.status, copy),
      brandMentioned:
        typeof parsed?.brandMentioned === "boolean"
          ? parsed.brandMentioned
          : null,
      brandRank:
        typeof parsed?.brandRank === "number" ? parsed.brandRank : null,
      answer,
      citations: citations
        .map((citation) => citation.domain || citation.url)
        .filter(Boolean)
        .slice(0, 5),
    });
  }

  return pdf.toUint8Array();
}

export function pdfFilename(value: string, suffix: string) {
  const slug =
    normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "report";
  return `${slug}-${suffix}.pdf`;
}

function metric(label: string, value: number | null | undefined) {
  return { label, value: typeof value === "number" ? value : null };
}

class PdfCanvas {
  private pages: string[][] = [];
  private commands: string[] = [];
  private y = CONTENT_TOP;
  private readonly reportTitle: string;
  private readonly generatedAt: Date;
  private readonly copy: PdfCopy;
  private readonly locale: SupportedLocale;

  constructor(
    reportTitle: string,
    generatedAt: Date,
    copy: PdfCopy,
    locale: SupportedLocale,
  ) {
    this.reportTitle = reportTitle;
    this.generatedAt = generatedAt;
    this.copy = copy;
    this.locale = locale;
    this.addPage();
  }

  cover(title: string, brandName: string, facts: string[]) {
    this.block(MARGIN, 116, PAGE_WIDTH - MARGIN * 2, 120, COLORS.primary);
    this.text("AI Visibility Radar", MARGIN + 24, 139, 13, "F2", COLORS.white);
    this.text(title, MARGIN + 24, 170, 28, "F2", COLORS.white);
    this.text(brandName, MARGIN + 24, 210, 18, "F1", COLORS.white);
    this.text(facts.join("  /  "), MARGIN + 24, 238, 10, "F1", COLORS.white);
    this.y = 286;
    this.note(
      this.copy.generatedNote(formatDateTime(this.generatedAt, this.locale)),
    );
  }

  section(title: string, minContentHeight = 0) {
    this.ensure(56 + minContentHeight);
    this.y += 12;
    this.text(title, MARGIN, this.y, 17, "F2", COLORS.ink);
    this.line(
      MARGIN,
      this.y + 27,
      PAGE_WIDTH - MARGIN,
      this.y + 27,
      COLORS.line,
    );
    this.y += 42;
  }

  subsection(title: string) {
    this.ensure(26);
    this.text(title, MARGIN, this.y, 11, "F2", COLORS.ink);
    this.y += 18;
  }

  paragraph(
    value: string,
    options: { size?: number; color?: Color; maxLines?: number } = {},
  ) {
    const size = options.size ?? 10;
    const lines = wrap(value, PAGE_WIDTH - MARGIN * 2, size).slice(
      0,
      options.maxLines,
    );
    for (const line of lines) {
      this.ensure(size + 7);
      this.text(line, MARGIN, this.y, size, "F1", options.color ?? COLORS.ink);
      this.y += size + 5;
    }
    this.y += 4;
  }

  note(value: string) {
    const lines = wrap(value, PAGE_WIDTH - MARGIN * 2 - 24, 10);
    const height = lines.length * 15 + 22;
    this.ensure(height);
    this.block(MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, height, COLORS.slate);
    this.strokeRect(
      MARGIN,
      this.y,
      PAGE_WIDTH - MARGIN * 2,
      height,
      COLORS.line,
    );
    let lineY = this.y + 14;
    for (const line of lines) {
      this.text(line, MARGIN + 12, lineY, 10, "F1", COLORS.muted);
      lineY += 15;
    }
    this.y += height + 8;
  }

  metricGrid(items: Array<{ label: string; value: number | null }>) {
    const gap = 12;
    const width = (PAGE_WIDTH - MARGIN * 2 - gap) / 2;
    const height = 86;
    items.forEach((item, index) => {
      if (index % 2 === 0) this.ensure(height + 12);
      const x = MARGIN + (index % 2) * (width + gap);
      const y = this.y;
      this.block(x, y, width, height, COLORS.slate);
      this.strokeRect(x, y, width, height, COLORS.line);
      this.text(item.label, x + 14, y + 14, 10, "F2", COLORS.muted);
      this.text(scoreText(item.value), x + 14, y + 36, 24, "F2", COLORS.ink);
      this.scoreBar(x + 14, y + 68, width - 28, 7, item.value ?? 0);
      if (index % 2 === 1) this.y += height + 12;
    });
    if (items.length % 2 === 1) this.y += height + 12;
  }

  keyValues(rows: Array<[string, string]>) {
    this.ensure(rows.length * KEY_VALUE_ROW_HEIGHT + 10);
    for (const [label, value] of rows) {
      this.text(label, MARGIN, this.y, 9, "F2", COLORS.muted);
      this.text(value, MARGIN + 165, this.y, 10, "F1", COLORS.ink);
      this.y += KEY_VALUE_ROW_HEIGHT;
    }
    this.y += 4;
  }

  lineChart(points: Array<{ label: string; value: number }>) {
    if (points.length === 0) return;
    const width = PAGE_WIDTH - MARGIN * 2;
    const x = MARGIN;
    this.ensure(LINE_CHART_REQUIRED_HEIGHT);
    const y = this.y;
    this.block(x, y, width, LINE_CHART_HEIGHT, COLORS.slate);
    this.strokeRect(x, y, width, LINE_CHART_HEIGHT, COLORS.line);

    const plotX = x + 34;
    const plotY = y + 24;
    const plotW = width - 58;
    const plotH = LINE_CHART_HEIGHT - 58;
    [0, 25, 50, 75, 100].forEach((tick) => {
      const tickY = plotY + plotH - (tick / 100) * plotH;
      this.line(plotX, tickY, plotX + plotW, tickY, COLORS.line);
      this.text(String(tick), x + 10, tickY - 6, 7, "F1", COLORS.muted);
    });

    const coords = points.map((point, index) => {
      const px =
        points.length === 1
          ? plotX + plotW / 2
          : plotX + (index / (points.length - 1)) * plotW;
      const py =
        plotY + plotH - (Math.max(0, Math.min(100, point.value)) / 100) * plotH;
      return [px, py] as const;
    });

    for (let index = 1; index < coords.length; index += 1) {
      const [x1, y1] = coords[index - 1]!;
      const [x2, y2] = coords[index]!;
      this.line(x1, y1, x2, y2, COLORS.primary, 2);
    }
    coords.forEach(([cx, cy]) => this.circle(cx, cy, 3.5, COLORS.primary));
    const first = points[0];
    const last = points[points.length - 1];
    if (first)
      this.text(
        first.label,
        plotX,
        y + LINE_CHART_HEIGHT - 22,
        8,
        "F1",
        COLORS.muted,
      );
    if (last) {
      this.text(
        last.label,
        plotX + plotW - textWidth(last.label, 8),
        y + LINE_CHART_HEIGHT - 22,
        8,
        "F1",
        COLORS.muted,
      );
    }
    this.y += LINE_CHART_HEIGHT + 18;
  }

  table(headers: string[], rows: string[][], widths: number[]) {
    const contentWidth = PAGE_WIDTH - MARGIN * 2;
    const baseWidth = widths.reduce((sum, width) => sum + width, 0);
    const columnWidths =
      baseWidth > 0
        ? widths.map((width) => (width / baseWidth) * contentWidth)
        : widths;
    this.ensure(TABLE_ROW_HEIGHT * 2);
    this.block(MARGIN, this.y, contentWidth, TABLE_ROW_HEIGHT, COLORS.ink);
    let x = MARGIN;
    headers.forEach((header, index) => {
      this.text(header, x + 8, this.y + 8, 8, "F2", COLORS.white);
      x += columnWidths[index] ?? 80;
    });
    this.y += TABLE_ROW_HEIGHT;
    for (const row of rows) {
      this.ensure(TABLE_ROW_HEIGHT + 2);
      this.strokeRect(
        MARGIN,
        this.y,
        contentWidth,
        TABLE_ROW_HEIGHT,
        COLORS.line,
      );
      let cellX = MARGIN;
      row.forEach((cell, index) => {
        const value = truncate(
          cell,
          Math.max(12, Math.floor((columnWidths[index] ?? 80) / 5)),
        );
        this.text(value, cellX + 8, this.y + 8, 8, "F1", COLORS.ink);
        cellX += columnWidths[index] ?? 80;
      });
      this.y += TABLE_ROW_HEIGHT;
    }
    this.y += 10;
  }

  callout(title: string, body: string, meta: string) {
    const bodyLines = wrap(body, PAGE_WIDTH - MARGIN * 2 - 24, 9).slice(0, 3);
    const height = 58 + bodyLines.length * 12;
    this.ensure(height);
    this.block(MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, height, COLORS.slate);
    this.strokeRect(
      MARGIN,
      this.y,
      PAGE_WIDTH - MARGIN * 2,
      height,
      COLORS.line,
    );
    this.text(title, MARGIN + 12, this.y + 12, 11, "F2", COLORS.ink);
    this.text(meta, MARGIN + 12, this.y + 30, 8, "F1", COLORS.muted);
    let y = this.y + 45;
    for (const line of bodyLines) {
      this.text(line, MARGIN + 12, y, 9, "F1", COLORS.ink);
      y += 12;
    }
    this.y += height + 8;
  }

  promptFinding(input: {
    prompt: string;
    engine: string;
    status: string;
    brandMentioned: boolean | null;
    brandRank: number | null;
    answer: string;
    citations: string[];
  }) {
    const promptLines = wrap(
      input.prompt,
      PAGE_WIDTH - MARGIN * 2 - 24,
      9,
    ).slice(0, 3);
    const answerLines = wrap(
      input.answer,
      PAGE_WIDTH - MARGIN * 2 - 24,
      8,
    ).slice(0, 7);
    const height = 98 + promptLines.length * 12 + answerLines.length * 11;
    this.ensure(height);
    this.block(MARGIN, this.y, PAGE_WIDTH - MARGIN * 2, height, COLORS.white);
    this.strokeRect(
      MARGIN,
      this.y,
      PAGE_WIDTH - MARGIN * 2,
      height,
      COLORS.line,
    );
    this.text(input.engine, MARGIN + 12, this.y + 12, 9, "F2", COLORS.primary);
    this.text(
      input.status,
      PAGE_WIDTH - MARGIN - 80,
      this.y + 12,
      9,
      "F2",
      COLORS.muted,
    );
    let y = this.y + 30;
    for (const line of promptLines) {
      this.text(line, MARGIN + 12, y, 9, "F2", COLORS.ink);
      y += 12;
    }
    const mentionText =
      input.brandMentioned === null
        ? this.copy.brandMentionUnknown
        : input.brandMentioned
          ? this.copy.brandMentionYes(
              input.brandRank ? `#${input.brandRank}` : "-",
            )
          : this.copy.brandMentionNo;
    this.text(mentionText, MARGIN + 12, y + 3, 8, "F1", COLORS.muted);
    y += 20;
    for (const line of answerLines) {
      this.text(line, MARGIN + 12, y, 8, "F1", COLORS.ink);
      y += 11;
    }
    const citations = input.citations.length
      ? this.copy.citations(input.citations.join(", "))
      : this.copy.noCitations;
    this.text(
      truncate(citations, 110),
      MARGIN + 12,
      this.y + height - 18,
      8,
      "F1",
      COLORS.muted,
    );
    this.y += height + 10;
  }

  toUint8Array() {
    const objects: string[] = [];
    const reserve = () => {
      objects.push("");
      return objects.length;
    };
    const set = (id: number, body: string) => {
      objects[id - 1] = body;
    };
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = reserve();
    const pagesId = reserve();
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const f2 = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    );
    const f3 = add(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
    );

    const pageIds: number[] = [];
    this.pages.forEach((commands) => {
      const stream = commands.join("\n");
      const contentId = add(
        `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
      );
      const pageId = add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      pageIds.push(pageId);
    });

    set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    set(
      pagesId,
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    );

    let output = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(output, "utf8"));
      output += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(output, "utf8");
    output += `xref\n0 ${objects.length + 1}\n`;
    output += "0000000000 65535 f \n";
    offsets.slice(1).forEach((offset) => {
      output += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Uint8Array(Buffer.from(output, "utf8"));
  }

  private addPage() {
    this.commands = [];
    this.pages.push(this.commands);
    this.y = CONTENT_TOP;
    this.drawShell(this.pages.length);
  }

  private drawShell(pageNumber: number) {
    this.block(0, 0, PAGE_WIDTH, 52, COLORS.ink);
    this.block(MARGIN, 18, 18, 18, COLORS.primary);
    this.text("AI Visibility Radar", MARGIN + 28, 18, 13, "F2", COLORS.white);
    this.text(
      this.reportTitle,
      PAGE_WIDTH - MARGIN - 130,
      20,
      8,
      "F1",
      COLORS.white,
    );
    this.line(MARGIN, 808, PAGE_WIDTH - MARGIN, 808, COLORS.line);
    this.text(
      `${this.copy.generatedLabel} ${shortDate(this.generatedAt, this.locale)}`,
      MARGIN,
      817,
      7,
      "F1",
      COLORS.muted,
    );
    this.text(
      `${this.copy.pageLabel} ${pageNumber}`,
      PAGE_WIDTH - MARGIN - 34,
      817,
      7,
      "F1",
      COLORS.muted,
    );
  }

  private ensure(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.addPage();
  }

  private scoreBar(
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
  ) {
    const bounded = Math.max(0, Math.min(100, value));
    this.block(x, y, width, height, rgb(226, 232, 240));
    this.block(x, y, (width * bounded) / 100, height, scoreColor(bounded));
  }

  private text(
    value: string,
    x: number,
    y: number,
    size: number,
    font: FontName = "F1",
    color: Color = COLORS.ink,
  ) {
    const [r, g, b] = color;
    this.commands.push(
      `BT /${font} ${size.toFixed(2)} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - y - size).toFixed(2)} Td (${escapePdfText(value)}) Tj ET`,
    );
  }

  private block(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ) {
    const [r, g, b] = color;
    this.commands.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`,
    );
  }

  private strokeRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ) {
    const [r, g, b] = color;
    this.commands.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG 0.75 w ${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`,
    );
  }

  private line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Color,
    width = 0.75,
  ) {
    const [r, g, b] = color;
    this.commands.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${(PAGE_HEIGHT - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - y2).toFixed(2)} l S`,
    );
  }

  private circle(x: number, y: number, radius: number, color: Color) {
    const [r, g, b] = color;
    this.commands.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${(x - radius).toFixed(2)} ${(PAGE_HEIGHT - y - radius).toFixed(2)} ${(radius * 2).toFixed(2)} ${(radius * 2).toFixed(2)} re f`,
    );
  }
}

function modelBreakdown(promptRuns: ReportPromptRun[]) {
  const rows = new Map<
    string,
    { engine: string; total: number; mentioned: number; failed: number }
  >();
  for (const run of promptRuns) {
    const bucket = rows.get(run.engine.engineName) ?? {
      engine: run.engine.engineName,
      total: 0,
      mentioned: 0,
      failed: 0,
    };
    bucket.total += 1;
    if (run.status === "failed") bucket.failed += 1;
    const parsed = parsedResult(run);
    if (parsed?.brandMentioned === true) bucket.mentioned += 1;
    rows.set(bucket.engine, bucket);
  }
  return [...rows.values()].sort((left, right) =>
    left.engine.localeCompare(right.engine),
  );
}

function parsedResult(run: ReportPromptRun) {
  return run.aiResponse?.parsedResult?.parsedJson as
    | { brandMentioned?: unknown; brandRank?: unknown; mentionCount?: unknown }
    | null
    | undefined;
}

function scoreText(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value)}/100` : "-";
}

function scoreColor(value: number): Color {
  if (value >= 75) return COLORS.emerald;
  if (value >= 45) return COLORS.amber;
  return COLORS.rose;
}

function formatDateTime(date: Date, locale: SupportedLocale) {
  return date.toLocaleString(dateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(date: Date, locale: SupportedLocale) {
  return date.toLocaleDateString(dateLocale(locale), {
    month: "short",
    day: "2-digit",
  });
}

function dateLocale(locale: SupportedLocale) {
  return locale === "sl" ? "sl-SI" : "en-US";
}

function formatStatus(status: string, copy: PdfCopy) {
  const normalized = status.trim().toLowerCase();
  return (
    copy.statuses[normalized] ??
    normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function wrap(value: string, maxWidth: number, size: number) {
  const words = normalizeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function textWidth(value: string, size: number) {
  return normalizeText(value).length * size * 0.52;
}

function truncate(value: string, maxLength: number) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeText(value: string) {
  return String(value)
    .replace(/–|—/g, "-")
    .replace(/•/g, "-")
    .replace(/€/g, "EUR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string) {
  return normalizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function rgb(r: number, g: number, b: number): Color {
  return [r / 255, g / 255, b / 255];
}
