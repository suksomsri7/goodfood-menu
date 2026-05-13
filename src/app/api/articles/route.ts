import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToBunny, isBase64Image, deleteFromBunny } from "@/lib/bunny";
import { generateArticleImages } from "@/lib/articleImagePipeline";
import { isArticleWriteAuthorized } from "@/lib/articleAuth";
import { ArticleStatus, Prisma } from "@prisma/client";

const ALLOWED_STATUS = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
type StatusInput = (typeof ALLOWED_STATUS)[number];

function normalizeStatus(raw: unknown): StatusInput | undefined {
  if (typeof raw !== "string") return undefined;
  const upper = raw.toUpperCase();
  if ((ALLOWED_STATUS as readonly string[]).includes(upper)) return upper as StatusInput;
  if (raw === "draft") return "DRAFT";
  if (raw === "published") return "PUBLISHED";
  return undefined;
}

function generateBaseSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/(^-|-$)/g, "") || `article-${Date.now()}`
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = normalizeStatus(searchParams.get("status"));
    const categoryId = searchParams.get("categoryId");
    const featured = searchParams.get("featured");
    const limit = searchParams.get("limit");

    const articles = await prisma.article.findMany({
      where: {
        ...(status && { status: status as ArticleStatus }),
        ...(categoryId && { categoryId }),
        ...(featured === "true" && { isFeatured: true }),
      },
      orderBy: [{ isFeatured: "desc" }, { order: "asc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        authorStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
      ...(limit && { take: parseInt(limit) }),
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isArticleWriteAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      title,
      excerpt,
      content,
      imageUrl,
      coverImage: coverImageInput,
      ogImage: ogImageInput,
      categoryId,
      tags,
      authorId,
      author,
      isFeatured,
      status,
      publishedAt,
      scheduledFor,
      readTime,
      metaDescription,
      focusKeyword,
      canonicalUrl,
      recipeData,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const baseSlug = generateBaseSlug(title);
    let slug = baseSlug;
    const existingSlug = await prisma.article.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now()}`;

    let coverImage: string | null = typeof coverImageInput === "string" ? coverImageInput : null;
    let ogImage: string | null = typeof ogImageInput === "string" ? ogImageInput : null;

    const primarySource = imageUrl || coverImage;
    if (primarySource && (isBase64Image(primarySource) || primarySource.startsWith("http"))) {
      try {
        const variants = await generateArticleImages(primarySource, "articles");
        coverImage = variants.coverImage;
        if (!ogImage) ogImage = variants.ogImage;
      } catch (err) {
        console.error("Image pipeline failed, falling back to plain upload:", err);
        if (isBase64Image(primarySource)) {
          coverImage = await uploadToBunny(primarySource, "articles", "article.jpg");
        }
      }
    }

    const normalizedStatus = normalizeStatus(status) ?? "DRAFT";

    let resolvedAuthorId: string | null = null;
    if (typeof authorId === "string" && authorId) {
      resolvedAuthorId = authorId;
    } else if (typeof author === "string" && author) {
      const staff = await prisma.staff.findFirst({ where: { name: author }, select: { id: true } });
      resolvedAuthorId = staff?.id ?? null;
    }

    const maxOrder = await prisma.article.aggregate({ _max: { order: true } });

    const article = await prisma.article.create({
      data: {
        title,
        slug,
        excerpt: excerpt ?? null,
        content: content ?? null,
        coverImage,
        ogImage,
        categoryId: categoryId || null,
        tags: tags ?? null,
        authorId: resolvedAuthorId,
        isFeatured: isFeatured || false,
        status: normalizedStatus as ArticleStatus,
        publishedAt: publishedAt
          ? new Date(publishedAt)
          : normalizedStatus === "PUBLISHED"
          ? new Date()
          : null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        readTime: readTime || 5,
        order: (maxOrder._max.order || 0) + 1,
        metaDescription: metaDescription ?? null,
        focusKeyword: focusKeyword ?? null,
        canonicalUrl: canonicalUrl ?? null,
        recipeData: recipeData ? (recipeData as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        authorStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
