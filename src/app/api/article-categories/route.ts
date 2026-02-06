import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายการหมวดบทความทั้งหมด
export async function GET() {
  try {
    const categories = await prisma.articleCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching article categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch article categories" },
      { status: 500 }
    );
  }
}

// POST - สร้างหมวดบทความใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Get max order
    const maxOrder = await prisma.articleCategory.aggregate({
      _max: { order: true },
    });

    const category = await prisma.articleCategory.create({
      data: {
        name,
        slug: slug || `category-${Date.now()}`,
        description,
        color: color || "#4CAF50",
        icon,
        order: (maxOrder._max.order || 0) + 1,
      },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating article category:", error);
    return NextResponse.json(
      { error: "Failed to create article category" },
      { status: 500 }
    );
  }
}
