import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staffAuth";

// PUT /api/restaurants/reorder - Reorder restaurants
export async function PUT(request: NextRequest) {
  const gate = await requireStaff(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid items" },
        { status: 400 }
      );
    }

    // Update each restaurant's order
    await Promise.all(
      items.map((item: { id: string; order: number }) =>
        prisma.restaurant.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering restaurants:", error);
    return NextResponse.json(
      { error: "Failed to reorder restaurants" },
      { status: 500 }
    );
  }
}
