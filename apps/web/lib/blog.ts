import { prisma, type BlogPostStatus } from "@ai-radar/db";
import type { SupportedLocale } from "@ai-radar/shared";

export type BlogPostCard = Awaited<ReturnType<typeof listBlogPosts>>[number];
export type BlogPostDetail = NonNullable<
  Awaited<ReturnType<typeof getBlogPostBySlug>>
>;

const PUBLISHED_STATUS: BlogPostStatus = "published";

export async function listBlogPosts(
  locale: SupportedLocale,
  input: { categorySlug?: string; authorSlug?: string; take?: number } = {},
) {
  const now = new Date();
  const categoryId = input.categorySlug
    ? await categoryIdForSlug(locale, input.categorySlug)
    : undefined;
  const authorId = input.authorSlug
    ? await authorIdForSlug(input.authorSlug)
    : undefined;

  if (input.categorySlug && !categoryId) return [];
  if (input.authorSlug && !authorId) return [];

  const posts = await prisma.blogPost.findMany({
    where: {
      status: PUBLISHED_STATUS,
      publishedAt: { lte: now },
      ...(categoryId ? { categoryId } : {}),
      ...(authorId ? { authorId } : {}),
      translations: { some: { locale } },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: input.take,
    include: {
      author: true,
      category: {
        include: {
          translations: { where: { locale }, take: 1 },
        },
      },
      translations: { where: { locale }, take: 1 },
    },
  });

  return posts
    .map((post) => {
      const translation = post.translations[0];
      if (!translation) return null;
      return {
        id: post.id,
        slug: translation.slug,
        title: translation.title,
        excerpt: translation.excerpt,
        publishedAt: post.publishedAt,
        heroImageUrl: post.heroImageUrl ?? translation.ogImageUrl,
        author: post.author,
        category: post.category
          ? {
              id: post.category.id,
              slug: post.category.translations[0]?.slug ?? post.category.slug,
              name: post.category.translations[0]?.name ?? post.category.slug,
            }
          : null,
      };
    })
    .filter((post): post is NonNullable<typeof post> => Boolean(post));
}

export async function getBlogPostBySlug(locale: SupportedLocale, slug: string) {
  const translation = await prisma.blogPostTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      post: {
        include: {
          author: true,
          category: {
            include: {
              translations: { where: { locale }, take: 1 },
            },
          },
          translations: true,
        },
      },
    },
  });

  if (!translation) return null;
  const post = translation.post;
  if (post.status !== PUBLISHED_STATUS) return null;
  if (!post.publishedAt || post.publishedAt > new Date()) return null;

  return {
    id: post.id,
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    contentMarkdown: translation.contentMarkdown,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    heroImageUrl: post.heroImageUrl ?? translation.ogImageUrl,
    author: post.author,
    category: post.category
      ? {
          id: post.category.id,
          slug: post.category.translations[0]?.slug ?? post.category.slug,
          name: post.category.translations[0]?.name ?? post.category.slug,
        }
      : null,
    alternateSlugs: post.translations.map((item) => ({
      locale: item.locale,
      slug: item.slug,
    })),
  };
}

export async function listBlogCategories(locale: SupportedLocale) {
  const categories = await prisma.blogCategory.findMany({
    orderBy: { slug: "asc" },
    include: {
      translations: { where: { locale }, take: 1 },
      _count: {
        select: {
          posts: {
            where: {
              status: PUBLISHED_STATUS,
              publishedAt: { lte: new Date() },
              translations: { some: { locale } },
            },
          },
        },
      },
    },
  });

  return categories
    .filter((category) => category._count.posts > 0)
    .map((category) => ({
      id: category.id,
      slug: category.translations[0]?.slug ?? category.slug,
      name: category.translations[0]?.name ?? category.slug,
      count: category._count.posts,
    }));
}

export async function getBlogCategoryBySlug(
  locale: SupportedLocale,
  slug: string,
) {
  return prisma.blogCategoryTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: { category: true },
  });
}

export async function getBlogAuthorBySlug(slug: string) {
  return prisma.blogAuthor.findUnique({ where: { slug } });
}

async function categoryIdForSlug(locale: SupportedLocale, slug: string) {
  const translation = await prisma.blogCategoryTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    select: { categoryId: true },
  });
  return translation?.categoryId;
}

async function authorIdForSlug(slug: string) {
  const author = await prisma.blogAuthor.findUnique({
    where: { slug },
    select: { id: true },
  });
  return author?.id;
}
