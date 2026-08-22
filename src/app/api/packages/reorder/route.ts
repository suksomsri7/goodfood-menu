import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/staffAuth";

// PUT - อัพเดทลำดับแพ็คเกจ
export async function PUT(request: NextRequest) {
  const gate = await requireStaff(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid items array" },
        { status: 400 }
      );
    }

    // Update order for each package
    const updatePromises = items.map(
      (item: { id: string; order: number }) =>
        prisma.package.update({
          where: { id: item.id },
          data: { order: item.order },
        })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering packages:", error);
    return NextResponse.json(
      { error: "Failed to reorder packages" },
      { status: 500 }
    );
  }
}
