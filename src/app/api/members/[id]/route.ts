import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายละเอียดสมาชิก
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        memberType: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        weightLogs: {
          orderBy: { date: "desc" },
          take: 30,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Failed to fetch member" },
      { status: 500 }
    );
  }
}

// PUT - อัปเดตข้อมูลสมาชิก
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, memberTypeId, aiCoachExpireDate } = body;

    const member = await prisma.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(memberTypeId !== undefined && { memberTypeId: memberTypeId || null }),
        ...(aiCoachExpireDate !== undefined && { aiCoachExpireDate: aiCoachExpireDate ? new Date(aiCoachExpireDate) : null }),
      },
      include: {
        memberType: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        weightLogs: {
          orderBy: { date: "desc" },
          take: 30,
        },
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE - ลบสมาชิก (Hard delete - สมาชิกที่กลับมาจะเริ่มต้นใหม่)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, displayName: true, lineUserId: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Delete related data first (due to foreign key constraints)
    await prisma.$transaction(async (tx) => {
      // Delete meal logs
      await tx.mealLog.deleteMany({ where: { memberId: id } });
      
      // Delete weight logs
      await tx.weightLog.deleteMany({ where: { memberId: id } });
      
      // Delete water logs
      await tx.waterLog.deleteMany({ where: { memberId: id } });
      
      // Delete exercise logs
      await tx.exerciseLog.deleteMany({ where: { memberId: id } });
      
      // Delete progress photos
      await tx.progressPhoto.deleteMany({ where: { memberId: id } });
      
      // Delete AI recommendation
      await tx.aiRecommendation.deleteMany({ where: { memberId: id } });
      
      // Delete AI usage logs
      await tx.aiUsageLog.deleteMany({ where: { memberId: id } });
      
      // Delete barcode scan history
      await tx.barcodeScanHistory.deleteMany({ where: { memberId: id } });
      
      // Delete cart items (directly on member, no Cart model)
      await tx.cartItem.deleteMany({ where: { memberId: id } });
      
      // Delete addresses
      await tx.address.deleteMany({ where: { memberId: id } });
      
      // Delete order items -> orders
      const orders = await tx.order.findMany({ where: { memberId: id }, select: { id: true } });
      for (const order of orders) {
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      }
      await tx.order.deleteMany({ where: { memberId: id } });
      
      // Finally delete the member
      await tx.member.delete({ where: { id } });
    });

    return NextResponse.json({ 
      success: true, 
      message: `Member ${member.displayName || member.lineUserId} deleted successfully` 
    });
  } catch (error) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
