import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { deleteFromBunny, isBase64Image, uploadToBunny } from "@/lib/bunny";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        authorStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isArticleWriteAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
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
      order,
      metaDescription,
      focusKeyword,
      canonicalUrl,
      recipeData,
      imagePrompt,
      socialCard,
    } = body;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    let nextCoverImage: string | null | undefined = undefined;
    let nextOgImage: string | null | undefined = undefined;

    if (coverImageInput !== undefined || ogImageInput !== undefined || imageUrl !== undefined) {
      const incomingPrimary =
        typeof imageUrl === "string"
          ? imageUrl
          : typeof coverImageInput === "string"
          ? coverImageInput
          : null;

      if (incomingPrimary === "" || incomingPrimary === null) {
        if (existing.coverImage) await deleteFromBunny(existing.coverImage);
        if (existing.ogImage) await deleteFromBunny(existing.ogImage);
        nextCoverImage = null;
        nextOgImage = null;
      } else if (incomingPrimary && (isBase64Image(incomingPrimary) || incomingPrimary.startsWith("http"))) {
        // Regenerate variants only when an actual new source is supplied (not a CDN URL we already returned).
        const looksLikeReupload =
          isBase64Image(incomingPrimary) ||
          (!incomingPrimary.includes("goodfood.b-cdn.net") && incomingPrimary.startsWith("http"));
        if (looksLikeReupload) {
          try {
            const variants = await generateArticleImages(incomingPrimary, "articles");
            if (existing.coverImage && existing.coverImage !== variants.coverImage) {
              await deleteFromBunny(existing.coverImage);
            }
            if (existing.ogImage && existing.ogImage !== variants.ogImage) {
              await deleteFromBunny(existing.ogImage);
            }
            nextCoverImage = variants.coverImage;
            nextOgImage = variants.ogImage;
          } catch (err) {
            console.error("Image pipeline failed:", err);
          }
        } else {
          nextCoverImage = incomingPrimary;
        }
      }

      if (typeof ogImageInput === "string" && ogImageInput && ogImageInput.startsWith("http")) {
        nextOgImage = ogImageInput;
      }
    }

    const nextStatus = normalizeStatus(status);
    let finalPublishedAt: Date | null | undefined =
      publishedAt === undefined
        ? undefined
        : publishedAt === null
        ? null
        : new Date(publishedAt);
    if (
      nextStatus === "PUBLISHED" &&
      existing.status !== "PUBLISHED" &&
      !existing.publishedAt &&
      finalPublishedAt === undefined
    ) {
      finalPublishedAt = new Date();
    }

    let resolvedAuthorId: string | null | undefined = undefined;
    if (authorId !== undefined) {
      resolvedAuthorId = authorId || null;
    } else if (typeof author === "string" && author) {
      const staff = await prisma.staff.findFirst({ where: { name: author }, select: { id: true } });
      resolvedAuthorId = staff?.id ?? null;
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...(nextCoverImage !== undefined && { coverImage: nextCoverImage }),
        ...(nextOgImage !== undefined && { ogImage: nextOgImage }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(tags !== undefined && { tags }),
        ...(resolvedAuthorId !== undefined && { authorId: resolvedAuthorId }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(nextStatus !== undefined && { status: nextStatus as ArticleStatus }),
        ...(finalPublishedAt !== undefined && { publishedAt: finalPublishedAt }),
        ...(scheduledFor !== undefined && {
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        }),
        ...(readTime !== undefined && { readTime }),
        ...(order !== undefined && { order }),
        ...(metaDescription !== undefined && { metaDescription }),
        ...(focusKeyword !== undefined && { focusKeyword }),
        ...(canonicalUrl !== undefined && { canonicalUrl }),
        ...(imagePrompt !== undefined && { imagePrompt }),
        ...(recipeData !== undefined && {
          recipeData:
            recipeData === null
              ? Prisma.JsonNull
              : (recipeData as Prisma.InputJsonValue),
        }),
        ...(socialCard !== undefined && {
          socialCard:
            socialCard === null
              ? Prisma.JsonNull
              : (socialCard as Prisma.InputJsonValue),
        }),
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        authorStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isArticleWriteAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const existing = await prisma.article.findUnique({ where: { id } });
    if (existing?.coverImage) await deleteFromBunny(existing.coverImage);
    if (existing?.ogImage) await deleteFromBunny(existing.ogImage);
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
}
