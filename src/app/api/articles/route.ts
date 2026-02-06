import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToBunny, isBase64Image } from "@/lib/bunny";

// GET - ดึงรายการบทความทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const categoryId = searchParams.get("categoryId");
    const featured = searchParams.get("featured");
    const limit = searchParams.get("limit");

    const articles = await prisma.article.findMany({
      where: {
        ...(status && { status }),
        ...(categoryId && { categoryId }),
        ...(featured === "true" && { isFeatured: true }),
      },
      orderBy: [
        { isFeatured: "desc" },
        { order: "asc" },
        { createdAt: "desc" },
      ],
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
      ...(limit && { take: parseInt(limit) }),
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

// POST - สร้างบทความใหม่
export async function POST(request: NextRequest) {
  try {
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
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    // Check if slug exists
    let slug = baseSlug || `article-${Date.now()}`;
    const existingSlug = await prisma.article.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Upload image to Bunny CDN if it's base64
    let finalImageUrl = imageUrl || null;
    if (imageUrl && isBase64Image(imageUrl)) {
      try {
        finalImageUrl = await uploadToBunny(imageUrl, "articles", "article.jpg");
      } catch (uploadError) {
        console.error("Failed to upload article image:", uploadError);
      }
    }

    // Get max order
    const maxOrder = await prisma.article.aggregate({
      _max: { order: true },
    });

    const article = await prisma.article.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        imageUrl: finalImageUrl,
        categoryId: categoryId || null,
        tags,
        author,
        isFeatured: isFeatured || false,
        status: status || "draft",
        publishedAt: publishedAt ? new Date(publishedAt) : (status === "published" ? new Date() : null),
        readTime: readTime || 5,
        order: (maxOrder._max.order || 0) + 1,
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

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}
