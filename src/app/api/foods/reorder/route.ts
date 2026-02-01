import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PUT - อัพเดทลำดับเมนูอาหาร
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid items array" },
        { status: 400 }
      );
    }

    // Update order for each food item
    const updatePromises = items.map(
      (item: { id: string; order: number }) =>
        prisma.food.update({
          where: { id: item.id },
          data: { order: item.order },
        })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering foods:", error);
    return NextResponse.json(
      { error: "Failed to reorder foods" },
      { status: 500 }
    );
  }
}
