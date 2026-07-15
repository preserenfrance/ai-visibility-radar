import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isSupportedLocale,
} from "@ai-radar/shared";

const RESERVED_PREFIXES = new Set([
  "api",
  "_next",
  "mcp",
  "images",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "rss.xml",
]);

export function pathLocale(pathname: string): SupportedLocale | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isSupportedLocale(firstSegment) ? firstSegment : null;
}

export function stripLocalePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (isSupportedLocale(segments[0])) segments.shift();
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

export function localizedPath(
  href: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (isReservedPath(href)) return href;

  const [pathWithMaybeLocale = "/", query = ""] = href.split("?");
  const path = stripLocalePrefix(pathWithMaybeLocale);
  const localized = path === "/" ? `/${locale}` : `/${locale}${path}`;
  return query ? `${localized}?${query}` : localized;
}

export function localeFromPathOrDefault(pathname: string) {
  return pathLocale(pathname) ?? DEFAULT_LOCALE;
}

export function supportedLocalePrefixes() {
  return SUPPORTED_LOCALES.map((locale) => `/${locale}`);
}

export function isReservedPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) return false;
  return RESERVED_PREFIXES.has(firstSegment) || /\.[a-z0-9]+$/i.test(pathname);
}
