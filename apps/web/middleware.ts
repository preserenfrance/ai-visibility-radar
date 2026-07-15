import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  type SupportedLocale,
  isSupportedLocale,
  normalizeLocale,
} from "@ai-radar/shared";
import {
  isReservedPath,
  pathLocale,
  stripLocalePrefix,
} from "./lib/locale-path";

const LOCALE_HEADER = "x-ai-radar-locale";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isReservedPath(pathname)) return NextResponse.next();

  const locale = pathLocale(pathname);
  if (locale) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = stripLocalePrefix(pathname);

    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);

    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers },
    });
    response.cookies.set(LOCALE_COOKIE_NAME, locale, cookieOptions());
    return response;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  const preferredLocale = requestPreferredLocale(request);
  redirectUrl.pathname =
    pathname === "/" ? `/${preferredLocale}` : `/${preferredLocale}${pathname}`;
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function requestPreferredLocale(request: NextRequest): SupportedLocale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isSupportedLocale(cookieLocale)) return cookieLocale;
  return normalizeLocale(request.headers.get("accept-language"));
}

function cookieOptions() {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
