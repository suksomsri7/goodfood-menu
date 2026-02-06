import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงหมวดบทความตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.articleCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching article category:", error);
    return NextResponse.json(
      { error: "Failed to fetch article category" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทหมวดบทความ
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, icon, isActive, order } = body;

    const category = await prisma.articleCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
      },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating article category:", error);
    return NextResponse.json(
      { error: "Failed to update article category" },
      { status: 500 }
    );
  }
}

// DELETE - ลบหมวดบทความ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if category has articles
    const category = await prisma.articleCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (category._count.articles > 0) {
      return NextResponse.json(
        { error: `ไม่สามารถลบหมวดหมู่นี้ได้ เพราะยังมีบทความ ${category._count.articles} บทความอยู่` },
        { status: 400 }
      );
    }

    await prisma.articleCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article category:", error);
    return NextResponse.json(
      { error: "Failed to delete article category" },
      { status: 500 }
    );
  }
}
