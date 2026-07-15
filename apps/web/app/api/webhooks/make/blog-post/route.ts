import { NextResponse } from "next/server";
import { getConfig } from "@ai-radar/config";
import { Prisma, prisma, type BlogPostStatus } from "@ai-radar/db";
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isSupportedLocale,
} from "@ai-radar/shared";
import { z } from "zod";

export const dynamic = "force-dynamic";

const translationSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  contentMarkdown: z.string().min(1),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  ogImageUrl: z.string().url().optional(),
});

const categoryTranslationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
});

const payloadSchema = z.object({
  externalId: z.string().min(1),
  status: z
    .enum(["draft", "published", "scheduled", "archived"])
    .default("draft"),
  publishedAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  heroImageUrl: z.string().url().optional(),
  authorEmail: z.string().email().optional(),
  authorName: z.string().optional(),
  author: z
    .object({
      email: z.string().email().optional(),
      slug: z.string().optional(),
      name: z.string().min(1),
      title: z.string().optional(),
      bio: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      websiteUrl: z.string().url().optional(),
      linkedinUrl: z.string().url().optional(),
    })
    .optional(),
  categorySlug: z.string().optional(),
  category: z
    .object({
      slug: z.string().min(1),
      translations: z
        .record(z.enum(SUPPORTED_LOCALES), categoryTranslationSchema)
        .optional(),
    })
    .optional(),
  translations: z
    .record(z.enum(SUPPORTED_LOCALES), translationSchema)
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one translation is required.",
    }),
});

export async function POST(request: Request) {
  const config = getConfig();
  if (!isAuthorized(request, config.MAKE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = payloadSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid blog payload", issues: payload.error.flatten() },
      { status: 400 },
    );
  }

  const result = await upsertBlogPost(payload.data);
  return NextResponse.json(result);
}

async function upsertBlogPost(input: z.infer<typeof payloadSchema>) {
  return prisma.$transaction(async (tx) => {
    const author = await upsertAuthor(tx, input);
    const category = await upsertCategory(tx, input);
    const publishedAt = input.publishedAt
      ? new Date(input.publishedAt)
      : input.status === "published"
        ? new Date()
        : null;

    const post = await tx.blogPost.upsert({
      where: { externalId: input.externalId },
      create: {
        externalId: input.externalId,
        status: input.status as BlogPostStatus,
        publishedAt,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        heroImageUrl: input.heroImageUrl,
        authorId: author?.id,
        categoryId: category?.id,
      },
      update: {
        status: input.status as BlogPostStatus,
        publishedAt,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        heroImageUrl: input.heroImageUrl,
        authorId: author?.id,
        categoryId: category?.id,
      },
    });

    const translations = await Promise.all(
      Object.entries(input.translations)
        .filter(([locale]) => isSupportedLocale(locale))
        .map(async ([locale, translation]) => {
          const supportedLocale = locale as SupportedLocale;
          return tx.blogPostTranslation.upsert({
            where: {
              postId_locale: { postId: post.id, locale: supportedLocale },
            },
            create: {
              postId: post.id,
              locale: supportedLocale,
              slug: slugify(
                translation.slug ?? translation.title,
                `${input.externalId}-${supportedLocale}`,
              ),
              title: translation.title,
              excerpt: translation.excerpt,
              contentMarkdown: translation.contentMarkdown,
              seoTitle: translation.seoTitle,
              seoDescription: translation.seoDescription,
              ogImageUrl: translation.ogImageUrl,
            },
            update: {
              slug: slugify(
                translation.slug ?? translation.title,
                `${input.externalId}-${supportedLocale}`,
              ),
              title: translation.title,
              excerpt: translation.excerpt,
              contentMarkdown: translation.contentMarkdown,
              seoTitle: translation.seoTitle,
              seoDescription: translation.seoDescription,
              ogImageUrl: translation.ogImageUrl,
            },
          });
        }),
    );

    return {
      id: post.id,
      externalId: post.externalId,
      status: post.status,
      translations: translations.map((translation) => ({
        locale: translation.locale,
        slug: translation.slug,
      })),
    };
  });
}

async function upsertAuthor(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof payloadSchema>,
) {
  const authorInput = input.author;
  const email = authorInput?.email ?? input.authorEmail;
  const name = authorInput?.name ?? input.authorName;
  if (!email && !name) return null;

  const slug = slugify(
    authorInput?.slug ?? name ?? email ?? "author",
    "author",
  );
  const data = {
    email,
    slug,
    name: name ?? email ?? "AI Visibility Radar",
    title: authorInput?.title,
    bio: authorInput?.bio,
    avatarUrl: authorInput?.avatarUrl,
    websiteUrl: authorInput?.websiteUrl,
    linkedinUrl: authorInput?.linkedinUrl,
  };

  if (email) {
    return tx.blogAuthor.upsert({
      where: { email },
      create: data,
      update: data,
    });
  }

  return tx.blogAuthor.upsert({
    where: { slug },
    create: data,
    update: data,
  });
}

async function upsertCategory(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof payloadSchema>,
) {
  const slug = slugify(
    input.category?.slug ?? input.categorySlug ?? "",
    "category",
  );
  if (!slug) return null;

  const category = await tx.blogCategory.upsert({
    where: { slug },
    create: { slug },
    update: {},
  });

  const translations = input.category?.translations ?? {};
  await Promise.all(
    SUPPORTED_LOCALES.map((locale) => {
      const translation = translations[locale];
      const name = translation?.name ?? humanizeSlug(slug);
      return tx.blogCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale } },
        create: {
          categoryId: category.id,
          locale,
          slug: slugify(translation?.slug ?? slug, slug),
          name,
          description: translation?.description,
        },
        update: {
          slug: slugify(translation?.slug ?? slug, slug),
          name,
          description: translation?.description,
        },
      });
    }),
  );

  return category;
}

function isAuthorized(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;
  const headerSecret = request.headers.get("x-llmvisio-webhook-secret");
  return bearer === secret || headerSecret === secret;
}

function slugify(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
