import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Linkedin,
  UserRound,
} from "lucide-react";
import { getConfig } from "@ai-radar/config";
import type { SupportedLocale } from "@ai-radar/shared";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getBlogAuthorBySlug,
  listBlogPosts,
  type BlogPostCard,
} from "@/lib/blog";
import { getI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";

const copy = {
  sl: {
    back: "Nazaj na blog",
    articles: "Clanki avtorja",
    empty: "Ta avtor se nima objavljenih clankov.",
    read: "Preberi",
  },
  en: {
    back: "Back to blog",
    articles: "Articles by this author",
    empty: "This author has no published articles yet.",
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
  const author = await getBlogAuthorBySlug(slug);
  if (!author) return {};
  const baseUrl = getConfig().NEXT_PUBLIC_APP_URL;

  return {
    title: `${author.name} | AI Visibility Radar Blog`,
    description: author.bio ?? `${author.name} on AI Visibility Radar Blog`,
    alternates: {
      canonical: `${baseUrl}${localizedPath(`/blog/authors/${slug}`, locale)}`,
    },
  };
}

export default async function BlogAuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { locale } = await getI18n();
  const page = copy[locale];
  const author = await getBlogAuthorBySlug(slug);
  if (!author) notFound();

  const posts = await listBlogPosts(locale, { authorSlug: slug });

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <Link
        href={localizedPath("/blog", locale)}
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {page.back}
      </Link>

      <section className="grid gap-6 rounded-lg border bg-white p-6 md:grid-cols-[auto_1fr]">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            className="h-28 w-28 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-secondary">
            <UserRound className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div>
          <h1 className="text-4xl font-semibold">{author.name}</h1>
          {author.title && (
            <p className="mt-2 text-muted-foreground">{author.title}</p>
          )}
          {author.bio && (
            <p className="mt-4 max-w-3xl leading-7">{author.bio}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {author.websiteUrl && (
              <Link
                href={author.websiteUrl}
                className="inline-flex items-center gap-2 text-primary"
              >
                Website <ExternalLink className="h-4 w-4" />
              </Link>
            )}
            {author.linkedinUrl && (
              <Link
                href={author.linkedinUrl}
                className="inline-flex items-center gap-2 text-primary"
              >
                LinkedIn <Linkedin className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{page.articles}</h2>
        {posts.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-5 rounded-lg border bg-white p-6 text-muted-foreground">
            {page.empty}
          </div>
        )}
      </section>
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
        {post.category && (
          <Link
            href={localizedPath(`/blog/category/${post.category.slug}`, locale)}
            className="w-fit rounded-sm bg-secondary px-2 py-1 text-xs"
          >
            {post.category.name}
          </Link>
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
