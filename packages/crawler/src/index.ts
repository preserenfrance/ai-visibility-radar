import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import {
  normalizeDomain,
  type CrawlResult,
  type CrawledPageSnapshot
} from "@ai-radar/shared";

export type CrawlDomainInput = {
  domain: string;
  maxPages?: number;
  timeoutMs?: number;
  rateLimitMs?: number;
  userAgent?: string;
};

const PRIORITY_KEYWORDS = [
  "about",
  "services",
  "products",
  "pricing",
  "faq",
  "blog",
  "case",
  "contact"
];

export async function crawlDomain(input: CrawlDomainInput): Promise<CrawlResult> {
  const domain = normalizeDomain(input.domain);
  const origin = `https://${domain}`;
  const maxPages = input.maxPages ?? 50;
  const timeoutMs = input.timeoutMs ?? 8000;
  const rateLimitMs = input.rateLimitMs ?? 700;
  const userAgent = input.userAgent ?? "AIVisibilityRadarBot/0.1 (+https://example.com/bot)";
  const pages: CrawledPageSnapshot[] = [];

  try {
    const robotsTxt = await fetchText(`${origin}/robots.txt`, timeoutMs, userAgent).catch(() => "");
    const robots = robotsParser(`${origin}/robots.txt`, robotsTxt);
    const sitemapUrl = await discoverSitemap(origin, robotsTxt, timeoutMs, userAgent);
    const queue = prioritizeUrls([
      origin,
      ...(sitemapUrl ? await fetchSitemapUrls(sitemapUrl, timeoutMs, userAgent).catch(() => []) : [])
    ]);
    const visited = new Set<string>();

    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift()!;
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl || visited.has(normalizedUrl) || !isInternalUrl(normalizedUrl, domain)) continue;
      visited.add(normalizedUrl);
      if (!robots.isAllowed(normalizedUrl, userAgent)) continue;

      await sleep(rateLimitMs);
      const crawled = await fetchPage(normalizedUrl, timeoutMs, userAgent).catch((error) => ({
        url: normalizedUrl,
        h2: [],
        statusCode: error?.statusCode ?? 0,
        discoveredAt: new Date().toISOString(),
        links: []
      }));

      pages.push(crawled);

      if (pages.length === 1 && crawled.links) {
        const links = crawled.links;
        for (const link of prioritizeUrls(links)) {
          if (!visited.has(link) && queue.length + pages.length < maxPages * 3) queue.push(link);
        }
      }
    }

    return {
      domain,
      pages,
      robotsTxt,
      sitemapUrl,
      failed: false
    };
  } catch (error) {
    return {
      domain,
      pages,
      failed: true,
      errorMessage: error instanceof Error ? error.message : "Unknown crawler error"
    };
  }
}

async function fetchPage(url: string, timeoutMs: number, userAgent: string): Promise<CrawledPageSnapshot> {
  const html = await fetchText(url, timeoutMs, userAgent);
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const title = text($("title").first().text());
  const metaDescription = text($('meta[name="description"]').attr("content") ?? "");
  const h1 = text($("h1").first().text());
  const h2 = $("h2")
    .map((_, element) => text($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 20);
  const main = $("main").length ? $("main") : $("body");
  const mainText = text(main.text()).slice(0, 12000);
  const canonicalUrl = $('link[rel="canonical"]').attr("href");
  const schemaJson = extractSchemaJson($);
  const links = $("a[href]")
    .map((_, element) => $(element).attr("href"))
    .get()
    .map((href) => {
      try {
        return new URL(href, url).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  return {
    url,
    title,
    metaDescription,
    h1,
    h2,
    mainText,
    schemaJson,
    statusCode: 200,
    canonicalUrl: canonicalUrl ? new URL(canonicalUrl, url).toString() : undefined,
    discoveredAt: new Date().toISOString(),
    links
  };
}

async function fetchText(url: string, timeoutMs: number, userAgent: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) {
      const error = new Error(`Fetch failed ${response.status} for ${url}`) as Error & {
        statusCode?: number;
      };
      error.statusCode = response.status;
      throw error;
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverSitemap(
  origin: string,
  robotsTxt: string,
  timeoutMs: number,
  userAgent: string
): Promise<string | undefined> {
  const robotsSitemap = robotsTxt.match(/^sitemap:\s*(.+)$/im)?.[1]?.trim();
  if (robotsSitemap) return robotsSitemap;

  const fallback = `${origin}/sitemap.xml`;
  await fetchText(fallback, timeoutMs, userAgent);
  return fallback;
}

async function fetchSitemapUrls(
  sitemapUrl: string,
  timeoutMs: number,
  userAgent: string
): Promise<string[]> {
  const xml = await fetchText(sitemapUrl, timeoutMs, userAgent);
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gim)].map((match) => match[1]!.trim());
  const nestedSitemaps = matches.filter((url) => url.endsWith(".xml")).slice(0, 5);
  const pageUrls = matches.filter((url) => !url.endsWith(".xml"));

  for (const nested of nestedSitemaps) {
    const nestedUrls = await fetchSitemapUrls(nested, timeoutMs, userAgent).catch(() => []);
    pageUrls.push(...nestedUrls);
  }

  return pageUrls;
}

function prioritizeUrls(urls: string[]): string[] {
  const unique = [...new Set(urls.map(normalizeUrl).filter((url): url is string => Boolean(url)))];
  return unique.sort((a, b) => scoreUrl(b) - scoreUrl(a));
}

function scoreUrl(url: string): number {
  const lower = url.toLowerCase();
  return PRIORITY_KEYWORDS.reduce((score, keyword) => (lower.includes(keyword) ? score + 10 : score), 0);
}

function isInternalUrl(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

function normalizeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function extractSchemaJson($: cheerio.CheerioAPI): unknown {
  const schemas = $('script[type="application/ld+json"]')
    .map((_, element) => {
      try {
        return JSON.parse($(element).text());
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);
  return schemas.length > 0 ? schemas : undefined;
}

function text(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
