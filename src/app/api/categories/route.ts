import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายการหมวดอาหารทั้งหมด
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { foods: true },
        },
      },
    });

    // แปลง _count เป็น foodCount
    const result = categories.map((cat) => ({
      ...cat,
      foodCount: cat._count.foods,
      _count: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST - สร้างหมวดอาหารใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // สร้าง slug จากชื่อถ้าไม่ได้ระบุ
    const finalSlug = slug || name.toLowerCase().replace(/\s+/g, "-");

    // หา order สูงสุด
    const maxOrder = await prisma.category.aggregate({
      _max: { order: true },
    });
    const newOrder = (maxOrder._max.order || 0) + 1;

    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        description: description || null,
        color: color || "#4CAF50",
        order: newOrder,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("Error creating category:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
