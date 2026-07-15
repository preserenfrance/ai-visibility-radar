import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import { getConfig } from "@ai-radar/config";
import type { SupportedLocale } from "@ai-radar/shared";
import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { getBlogPostBySlug } from "@/lib/blog";
import { getI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";

const copy = {
  sl: {
    back: "Nazaj na blog",
    author: "Avtor",
    category: "Kategorija",
    metadataFallback: "AI Visibility Radar blog clanek.",
  },
  en: {
    back: "Back to blog",
    author: "Author",
    category: "Category",
    metadataFallback: "AI Visibility Radar blog article.",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getI18n();
  const post = await getBlogPostBySlug(locale, slug);
  if (!post) return {};

  const baseUrl = getConfig().NEXT_PUBLIC_APP_URL;
  const alternates = Object.fromEntries(
    post.alternateSlugs
      .filter(
        (item): item is { locale: SupportedLocale; slug: string } =>
          item.locale === "sl" || item.locale === "en",
      )
      .map((item) => [
        item.locale,
        `${baseUrl}${localizedPath(`/blog/${item.slug}`, item.locale)}`,
      ]),
  );

  return {
    title: post.seoTitle ?? post.title,
    description:
      post.seoDescription ?? post.excerpt ?? copy[locale].metadataFallback,
    alternates: {
      canonical: `${baseUrl}${localizedPath(`/blog/${post.slug}`, locale)}`,
      languages: alternates,
    },
    openGraph: {
      type: "article",
      title: post.seoTitle ?? post.title,
      description:
        post.seoDescription ?? post.excerpt ?? copy[locale].metadataFallback,
      images: post.heroImageUrl ? [post.heroImageUrl] : undefined,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale } = await getI18n();
  const post = await getBlogPostBySlug(locale, slug);
  if (!post) notFound();

  const page = copy[locale];

  return (
    <main>
      <article className="mx-auto max-w-4xl px-5 py-12">
        <Link
          href={localizedPath("/blog", locale)}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {page.back}
        </Link>

        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {post.category && (
            <Link
              href={localizedPath(
                `/blog/category/${post.category.slug}`,
                locale,
              )}
            >
              <Badge variant="secondary">{post.category.name}</Badge>
            </Link>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {formatDate(post.publishedAt, locale)}
          </span>
        </div>

        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        {post.heroImageUrl && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border bg-secondary">
            <img
              src={post.heroImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {post.author && (
          <AuthorBox locale={locale} label={page.author} author={post.author} />
        )}

        <div className="mt-10 border-t pt-10">
          <MarkdownContent content={post.contentMarkdown} />
        </div>
      </article>
    </main>
  );
}

function AuthorBox({
  locale,
  label,
  author,
}: {
  locale: SupportedLocale;
  label: string;
  author: {
    slug: string;
    name: string;
    title: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}) {
  return (
    <div className="mt-8 flex gap-4 rounded-lg border bg-white p-4">
      {author.avatarUrl ? (
        <img
          src={author.avatarUrl}
          alt=""
          className="h-14 w-14 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
          <UserRound className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          {label}
        </div>
        <Link
          href={localizedPath(`/blog/authors/${author.slug}`, locale)}
          className="mt-1 block font-semibold"
        >
          {author.name}
        </Link>
        {author.title && (
          <div className="text-sm text-muted-foreground">{author.title}</div>
        )}
        {author.bio && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {author.bio}
          </p>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date, locale: SupportedLocale) {
  return date.toLocaleDateString(locale === "sl" ? "sl-SI" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
