import { Prisma, prisma } from "@ai-radar/db";
import { stripLocalePrefix } from "@/lib/locale-path";

export type AnalyticsPropertyValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

export type WebsiteFunnelAnalytics = Awaited<
  ReturnType<typeof getWebsiteFunnelAnalytics>
>;

const DEFAULT_WINDOW_DAYS = 30;
const MAX_PROPERTY_KEY_LENGTH = 80;
const MAX_PROPERTY_VALUE_LENGTH = 500;

const MARKETING_PATH_PREFIXES = [
  "/blog",
  "/faq",
  "/mcp-access",
  "/pricing",
  "/contact",
  "/privacy",
  "/ai-visibility-checker",
] as const;

const EXCLUDED_PAGEVIEW_PREFIXES = [
  "/admin",
  "/api",
  "/app",
  "/audit",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/unsubscribe",
] as const;

export function normalizeAnalyticsPath(path: string) {
  const withoutOrigin = path.replace(/^https?:\/\/[^/]+/i, "");
  const [pathname = "/"] = withoutOrigin.split(/[?#]/);
  const normalized = stripLocalePrefix(pathname || "/");
  return normalized === "" ? "/" : normalized;
}

export function shouldRecordPageView(path: string) {
  const normalizedPath = normalizeAnalyticsPath(path);
  if (normalizedPath.includes(".")) return false;
  return !EXCLUDED_PAGEVIEW_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
}

export function sanitizeAnalyticsProperties(
  properties: unknown,
): Prisma.InputJsonObject {
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return {};
  }

  const entries: Array<[string, Prisma.InputJsonValue | null]> = [];
  for (const [rawKey, rawValue] of Object.entries(
    properties as Record<string, unknown>,
  ).slice(0, 40)) {
    const key = rawKey.trim().slice(0, MAX_PROPERTY_KEY_LENGTH);
    if (!key) continue;

    if (typeof rawValue === "string") {
      entries.push([key, rawValue.slice(0, MAX_PROPERTY_VALUE_LENGTH)]);
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      entries.push([key, rawValue]);
      continue;
    }
    if (typeof rawValue === "boolean" || rawValue === null) {
      entries.push([key, rawValue]);
    }
  }

  return Object.fromEntries(entries) as Prisma.InputJsonObject;
}

export async function getWebsiteFunnelAnalytics(
  windowDays = DEFAULT_WINDOW_DAYS,
  now = new Date(),
) {
  const startedAt = startOfDay(daysAgo(now, windowDays - 1));
  const days = lastDays(windowDays, now);
  const eventWhere = { createdAt: { gte: startedAt } };

  const [pageViews, funnelEvents, freeAuditLeads, checkoutStarts, topPages] =
    await Promise.all([
      prisma.websiteEvent.findMany({
        where: {
          ...eventWhere,
          eventName: "page_view",
        },
        select: {
          visitorId: true,
          normalizedPath: true,
          createdAt: true,
        },
      }),
      prisma.websiteEvent.findMany({
        where: {
          ...eventWhere,
          eventName: {
            in: [
              "first_scan_cta_click",
              "free_audit_cta_click",
              "upgrade_plan_click",
            ],
          },
        },
        select: {
          eventName: true,
          visitorId: true,
          normalizedPath: true,
          properties: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.lead.findMany({
        where: {
          createdAt: { gte: startedAt },
          source: "free_audit",
        },
        select: {
          id: true,
          email: true,
          domain: true,
          brandName: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startedAt },
          action: "billing_checkout_started",
        },
      }),
      prisma.websiteEvent.groupBy({
        by: ["normalizedPath"],
        where: {
          ...eventWhere,
          eventName: "page_view",
        },
        _count: { _all: true },
        orderBy: { _count: { normalizedPath: "desc" } },
        take: 12,
      }),
    ]);

  const marketingPageViews = pageViews.filter((event) =>
    isMarketingPath(event.normalizedPath),
  );
  const pricingViews = pageViews.filter(
    (event) => event.normalizedPath === "/pricing",
  );
  const checkerViews = pageViews.filter(
    (event) => event.normalizedPath === "/ai-visibility-checker",
  );
  const freeAuditClicks = funnelEvents.filter(
    (event) => event.eventName === "free_audit_cta_click",
  );
  const firstScanClicks = funnelEvents.filter(
    (event) => event.eventName === "first_scan_cta_click",
  );
  const upgradeClicks = funnelEvents.filter(
    (event) => event.eventName === "upgrade_plan_click",
  );
  const validFreeAuditClicks = freeAuditClicks.filter(
    (event) => propertyBoolean(event.properties, "valid_prompt_count") === true,
  );

  return {
    startedAt,
    endedAt: now,
    windowDays,
    totals: {
      websiteVisitors: distinctVisitors(marketingPageViews),
      websitePageViews: marketingPageViews.length,
      pricingVisitors: distinctVisitors(pricingViews),
      pricingViews: pricingViews.length,
      checkerVisitors: distinctVisitors(checkerViews),
      checkerViews: checkerViews.length,
      firstScanClicks: firstScanClicks.length,
      freeAuditClicks: freeAuditClicks.length,
      validFreeAuditClicks: validFreeAuditClicks.length,
      freeAuditStarts: freeAuditLeads.length,
      freeAuditEmails: new Set(
        freeAuditLeads.map((lead) => lead.email.trim().toLowerCase()),
      ).size,
      upgradeClicks: upgradeClicks.length,
      upgradeClickVisitors: distinctVisitors(upgradeClicks),
      checkoutStarts,
    },
    rates: {
      pricingViewRate: percentage(
        distinctVisitors(pricingViews),
        distinctVisitors(marketingPageViews),
      ),
      checkerViewRate: percentage(
        distinctVisitors(checkerViews),
        distinctVisitors(marketingPageViews),
      ),
      freeAuditStartRate: percentage(
        freeAuditLeads.length,
        distinctVisitors(marketingPageViews),
      ),
      freeAuditClickToStartRate: percentage(
        freeAuditLeads.length,
        Math.max(validFreeAuditClicks.length, freeAuditClicks.length),
      ),
      pricingToUpgradeClickRate: percentage(
        distinctVisitors(upgradeClicks),
        Math.max(1, distinctVisitors(pricingViews)),
      ),
      upgradeClickToCheckoutRate: percentage(
        checkoutStarts,
        upgradeClicks.length,
      ),
    },
    chart: {
      series: [
        {
          key: "visitors",
          label: "Website visitors",
          color: "#2563eb",
          total: distinctVisitors(marketingPageViews),
        },
        {
          key: "pricing_views",
          label: "Pricing views",
          color: "#0f766e",
          total: pricingViews.length,
        },
        {
          key: "free_audit_starts",
          label: "Free audit starts",
          color: "#d97706",
          total: freeAuditLeads.length,
        },
        {
          key: "upgrade_clicks",
          label: "Upgrade clicks",
          color: "#dc2626",
          total: upgradeClicks.length,
        },
      ],
      points: buildDailyFunnelPoints({
        days,
        marketingPageViews,
        pricingViews,
        freeAuditLeads,
        upgradeClicks,
      }),
    },
    upgradeBreakdown: breakdownByProperty(upgradeClicks, "plan"),
    upgradeLocations: breakdownByProperty(upgradeClicks, "location"),
    freeAuditLocations: breakdownByProperty(freeAuditClicks, "location"),
    topPages: topPages
      .filter((page) => isMarketingPath(page.normalizedPath))
      .map((page) => ({
        path: page.normalizedPath,
        views: page._count._all,
      })),
    latestFreeAuditLeads: freeAuditLeads.slice(0, 10),
  };
}

function isMarketingPath(path: string) {
  if (path === "/") return true;
  return MARKETING_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function buildDailyFunnelPoints({
  days,
  marketingPageViews,
  pricingViews,
  freeAuditLeads,
  upgradeClicks,
}: {
  days: Array<{ date: Date; key: string; label: string }>;
  marketingPageViews: Array<{ visitorId: string; createdAt: Date }>;
  pricingViews: Array<{ createdAt: Date }>;
  freeAuditLeads: Array<{ createdAt: Date }>;
  upgradeClicks: Array<{ createdAt: Date }>;
}) {
  return days.map((day) => {
    const visitors = new Set(
      marketingPageViews
        .filter((event) => dayKey(event.createdAt) === day.key)
        .map((event) => event.visitorId),
    );

    return {
      date: day.key,
      label: day.label,
      values: {
        visitors: visitors.size,
        pricing_views: countOnDay(pricingViews, day.key),
        free_audit_starts: countOnDay(freeAuditLeads, day.key),
        upgrade_clicks: countOnDay(upgradeClicks, day.key),
      },
    };
  });
}

function breakdownByProperty(
  events: Array<{ properties: Prisma.JsonValue }>,
  propertyName: string,
) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const value = propertyString(event.properties, propertyName) ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    );
}

function propertyString(properties: Prisma.JsonValue, key: string) {
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return null;
  }
  const value = (properties as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

function propertyBoolean(properties: Prisma.JsonValue, key: string) {
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return null;
  }
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function distinctVisitors(events: Array<{ visitorId: string }>) {
  return new Set(events.map((event) => event.visitorId)).size;
}

function countOnDay(events: Array<{ createdAt: Date }>, key: string) {
  return events.filter((event) => dayKey(event.createdAt) === key).length;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function lastDays(count: number, now: Date) {
  const end = startOfDay(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (count - index - 1));
    return {
      date,
      key: dayKey(date),
      label: `${date.getDate()}.${date.getMonth() + 1}.`,
    };
  });
}

function daysAgo(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
