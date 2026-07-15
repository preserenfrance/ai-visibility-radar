import type { MetadataRoute } from "next";
import { getConfig } from "@ai-radar/config";
import { prisma } from "@ai-radar/db";
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from "@ai-radar/shared";
import { localizedPath } from "@/lib/locale-path";

export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "/",
  "/ai-visibility-checker",
  "/pricing",
  "/mcp-access",
  "/faq",
  "/blog",
  "/contact",
  "/privacy",
  "/login",
  "/signup",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getConfig().NEXT_PUBLIC_APP_URL;
  const now = new Date();

  const staticEntries = SUPPORTED_LOCALES.flatMap((locale) =>
    STATIC_PATHS.map((path) => ({
      url: absoluteUrl(baseUrl, localizedPath(path, locale)),
      lastModified: now,
    })),
  );

  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published",
      publishedAt: { lte: now },
    },
    select: {
      updatedAt: true,
      translations: {
        select: { locale: true, slug: true },
      },
    },
  });

  const blogEntries = posts.flatMap((post) =>
    post.translations
      .filter((translation) => isSupportedLocale(translation.locale))
      .map((translation) => ({
        url: absoluteUrl(
          baseUrl,
          localizedPath(
            `/blog/${translation.slug}`,
            translation.locale as SupportedLocale,
          ),
        ),
        lastModified: post.updatedAt,
      })),
  );

  return [...staticEntries, ...blogEntries];
}

function absoluteUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}
