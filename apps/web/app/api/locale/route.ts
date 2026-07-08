import { NextResponse } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  isSupportedLocale,
} from "@ai-radar/shared";
import { prisma } from "@ai-radar/db";
import { getCurrentUserSummary } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    locale?: unknown;
  };
  const locale = normalizeLocale(body.locale);
  const response = NextResponse.json({ locale });

  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  await updateUserLocale(locale);

  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLocale = url.searchParams.get("locale");
  const locale = normalizeLocale(requestedLocale);
  const redirectTo = safeRedirectPath(url.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(redirectTo, url.origin));

  if (isSupportedLocale(locale)) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    await updateUserLocale(locale);
  }

  return response;
}

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

async function updateUserLocale(locale: string) {
  const user = await getCurrentUserSummary().catch(() => null);
  if (!user) return;
  await prisma.user
    .update({ where: { id: user.id }, data: { preferredLocale: locale } })
    .catch(() => null);
}
