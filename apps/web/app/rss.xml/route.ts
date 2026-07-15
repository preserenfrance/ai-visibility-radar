import { NextResponse } from "next/server";
import { getConfig } from "@ai-radar/config";
import { prisma } from "@ai-radar/db";
import { isSupportedLocale, type SupportedLocale } from "@ai-radar/shared";
import { localizedPath } from "@/lib/locale-path";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getConfig().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const now = new Date();
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published",
      publishedAt: { lte: now },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      author: true,
      translations: true,
    },
  });

  const items = posts.flatMap((post) =>
    post.translations
      .filter((translation) => isSupportedLocale(translation.locale))
      .map((translation) => {
        const locale = translation.locale as SupportedLocale;
        const url = `${baseUrl}${localizedPath(
          `/blog/${translation.slug}`,
          locale,
        )}`;
        return `
          <item>
            <title>${xml(translation.title)}</title>
            <link>${xml(url)}</link>
            <guid>${xml(url)}</guid>
            <description>${xml(
              translation.excerpt ??
                firstParagraph(translation.contentMarkdown),
            )}</description>
            <pubDate>${(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate>
            ${post.author ? `<author>${xml(post.author.name)}</author>` : ""}
          </item>`;
      }),
  );

  const feed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>AI Visibility Radar Blog</title>
        <link>${xml(`${baseUrl}${localizedPath("/blog", "en")}`)}</link>
        <description>AI visibility, generative search and brand optimization articles.</description>
        <language>en</language>
        <lastBuildDate>${now.toUTCString()}</lastBuildDate>
        ${items.join("\n")}
      </channel>
    </rss>`;

  return new NextResponse(feed.trim(), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}

function firstParagraph(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean)
    ?.replace(/^#+\s+/, "")
    .slice(0, 240);
}

function xml(value: string | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
