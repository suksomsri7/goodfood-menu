import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ id: string }>;
}

// GET - ดึงหมวดอาหารตาม ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { foods: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...category,
      foodCount: category._count.foods,
      _count: undefined,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

// PUT - แก้ไขหมวดอาหาร
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, color, isActive, order, restaurantId } = body;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
        ...(restaurantId !== undefined && { restaurantId }),
      },
    });

    return NextResponse.json(category);
  } catch (error: any) {
    console.error("Error updating category:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE - ลบหมวดอาหาร
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // ตรวจสอบว่ามีเมนูอาหารในหมวดนี้หรือไม่
    const foodCount = await prisma.food.count({
      where: { categoryId: id },
    });

    if (foodCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${foodCount} foods. Please move or delete foods first.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting category:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}

// PATCH - Toggle สถานะหรือเปลี่ยน order
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive, order } = body;

    const updateData: { isActive?: boolean; order?: number } = {};
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    
    if (order !== undefined) {
      updateData.order = order;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(category);
  } catch (error: any) {
    console.error("Error patching category:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}
