import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { getConfig } from "@ai-radar/config";
import type { SupportedLocale } from "@ai-radar/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";
import {
  listBlogCategories,
  listBlogPosts,
  type BlogPostCard,
} from "@/lib/blog";

const copy = {
  sl: {
    title: "Blog",
    intro:
      "Vodici, primeri in analize o AI vidnosti, generativnem iskanju, citatih in tem, kako modeli razumejo znamke.",
    eyebrow: "AI Visibility Radar blog",
    empty: "Objavljeni clanki se bodo prikazali tukaj.",
    categories: "Kategorije",
    read: "Preberi",
    metadataTitle: "Blog | AI Visibility Radar",
    metadataDescription:
      "Clanki o AI vidnosti, ChatGPT odgovorih, generativnem iskanju in optimizaciji znamk za AI asistente.",
  },
  en: {
    title: "Blog",
    intro:
      "Guides, examples and analysis on AI visibility, generative search, citations and how models understand brands.",
    eyebrow: "AI Visibility Radar blog",
    empty: "Published articles will appear here.",
    categories: "Categories",
    read: "Read",
    metadataTitle: "Blog | AI Visibility Radar",
    metadataDescription:
      "Articles about AI visibility, ChatGPT answers, generative search and optimizing brands for AI assistants.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const page = copy[locale];
  const baseUrl = getConfig().NEXT_PUBLIC_APP_URL;

  return {
    title: page.metadataTitle,
    description: page.metadataDescription,
    alternates: {
      canonical: `${baseUrl}${localizedPath("/blog", locale)}`,
      languages: {
        sl: `${baseUrl}${localizedPath("/blog", "sl")}`,
        en: `${baseUrl}${localizedPath("/blog", "en")}`,
      },
    },
  };
}

export default async function BlogIndexPage() {
  const { locale } = await getI18n();
  const page = copy[locale];
  const [posts, categories] = await Promise.all([
    listBlogPosts(locale),
    listBlogCategories(locale),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <section className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Badge variant="secondary" className="mb-4">
            <Newspaper className="mr-2 h-3.5 w-3.5" />
            {page.eyebrow}
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight">
            {page.title}
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
            {page.intro}
          </p>
        </div>
        {categories.length > 0 && (
          <div className="flex max-w-xl flex-wrap gap-2">
            <span className="w-full text-xs font-semibold uppercase text-muted-foreground">
              {page.categories}
            </span>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={localizedPath(`/blog/category/${category.slug}`, locale)}
                className="rounded-sm bg-secondary px-3 py-1 text-sm hover:bg-secondary/75"
              >
                {category.name} ({category.count})
              </Link>
            ))}
          </div>
        )}
      </section>

      {posts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCardItem
              key={post.id}
              locale={locale}
              post={post}
              readLabel={page.read}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-6 text-muted-foreground">
          {page.empty}
        </div>
      )}
    </main>
  );
}

function BlogPostCardItem({
  locale,
  post,
  readLabel,
}: {
  locale: SupportedLocale;
  post: BlogPostCard;
  readLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {post.category && (
            <Link
              href={localizedPath(
                `/blog/category/${post.category.slug}`,
                locale,
              )}
              className="rounded-sm bg-secondary px-2 py-1 text-foreground"
            >
              {post.category.name}
            </Link>
          )}
          {post.publishedAt && (
            <time>{formatDate(post.publishedAt, locale)}</time>
          )}
        </div>
        <CardTitle className="text-xl leading-tight">
          <Link href={localizedPath(`/blog/${post.slug}`, locale)}>
            {post.title}
          </Link>
        </CardTitle>
        {post.excerpt && <CardDescription>{post.excerpt}</CardDescription>}
        <Link
          href={localizedPath(`/blog/${post.slug}`, locale)}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          {readLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
    </Card>
  );
}

function formatDate(date: Date, locale: SupportedLocale) {
  return date.toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
