import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToBunny, deleteFromBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงบทความตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทบทความ
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      excerpt,
      content,
      imageUrl,
      categoryId,
      tags,
      author,
      isFeatured,
      status,
      publishedAt,
      readTime,
      order,
    } = body;

    // Get existing article
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Handle image upload/delete
    let finalImageUrl = imageUrl;
    if (imageUrl !== undefined) {
      if (imageUrl && isBase64Image(imageUrl)) {
        // Delete old image and upload new one
        if (existing.imageUrl) {
          await deleteFromBunny(existing.imageUrl);
        }
        finalImageUrl = await uploadToBunny(imageUrl, "articles", "article.jpg");
      } else if (!imageUrl && existing.imageUrl) {
        // Delete old image
        await deleteFromBunny(existing.imageUrl);
        finalImageUrl = null;
      }
    }

    // Auto-set publishedAt when status changes to published
    let finalPublishedAt = publishedAt !== undefined ? publishedAt : undefined;
    if (status === "published" && existing.status !== "published" && !existing.publishedAt) {
      finalPublishedAt = new Date().toISOString();
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...(finalImageUrl !== undefined && { imageUrl: finalImageUrl }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(tags !== undefined && { tags }),
        ...(author !== undefined && { author }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(status !== undefined && { status }),
        ...(finalPublishedAt !== undefined && {
          publishedAt: finalPublishedAt ? new Date(finalPublishedAt) : null,
        }),
        ...(readTime !== undefined && { readTime }),
        ...(order !== undefined && { order }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}

// DELETE - ลบบทความ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get existing article to delete image
    const existing = await prisma.article.findUnique({ where: { id } });
    if (existing?.imageUrl) {
      await deleteFromBunny(existing.imageUrl);
    }

    await prisma.article.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}
