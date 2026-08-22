import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { trustedMember } from "@/lib/memberAuth";
import { readStaff } from "@/lib/staffAuth";

// PATCH - Update order item quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { quantity } = body;

    if (quantity === undefined || quantity < 0) {
      return NextResponse.json(
        { error: "Invalid quantity" },
        { status: 400 }
      );
    }

    // Find the order item first
    const existingItem = await prisma.orderItem.findUnique({
      where: { id },
      include: { order: { select: { memberId: true } } },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      );
    }

    // 🔴 เดิมแก้/ลบรายการในออเดอร์ของใครก็ได้จาก id ล้วน — ต้องเป็นเจ้าของออเดอร์หรือพนักงาน
    const member = await trustedMember(request);
    const isOwner = !!member && !!existingItem.order?.memberId && member.id === existingItem.order.memberId;
    if (!isOwner && !(await readStaff(request))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (quantity === 0) {
      // Delete the item if quantity is 0
      await prisma.orderItem.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Update the quantity
    const updatedItem = await prisma.orderItem.update({
      where: { id },
      data: { quantity },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Error updating order item:", error);
    return NextResponse.json(
      { error: "Failed to update order item" },
      { status: 500 }
    );
  }
}
