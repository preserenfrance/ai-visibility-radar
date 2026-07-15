import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getConfig } from "@ai-radar/config";
import type { SupportedLocale } from "@ai-radar/shared";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getBlogCategoryBySlug,
  listBlogPosts,
  type BlogPostCard,
} from "@/lib/blog";
import { getI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";

const copy = {
  sl: {
    back: "Nazaj na blog",
    titlePrefix: "Kategorija",
    empty: "V tej kategoriji se ni objavljenih clankov.",
    read: "Preberi",
  },
  en: {
    back: "Back to blog",
    titlePrefix: "Category",
    empty: "There are no published articles in this category.",
    read: "Read",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getI18n();
  const category = await getBlogCategoryBySlug(locale, slug);
  if (!category) return {};
  const baseUrl = getConfig().NEXT_PUBLIC_APP_URL;

  return {
    title: `${category.name} | Blog | AI Visibility Radar`,
    description:
      category.description ?? `${copy[locale].titlePrefix}: ${category.name}`,
    alternates: {
      canonical: `${baseUrl}${localizedPath(`/blog/category/${slug}`, locale)}`,
    },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale } = await getI18n();
  const page = copy[locale];
  const category = await getBlogCategoryBySlug(locale, slug);
  if (!category) notFound();

  const posts = await listBlogPosts(locale, { categorySlug: slug });

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <Link
        href={localizedPath("/blog", locale)}
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {page.back}
      </Link>
      <h1 className="text-4xl font-semibold leading-tight">
        {page.titlePrefix}: {category.name}
      </h1>
      {category.description && (
        <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
          {category.description}
        </p>
      )}

      {posts.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="mt-8 rounded-lg border bg-white p-6 text-muted-foreground">
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
        {post.publishedAt && (
          <time className="text-xs text-muted-foreground">
            {formatDate(post.publishedAt, locale)}
          </time>
        )}
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
