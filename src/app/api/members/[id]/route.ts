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
  let step = "init";
  try {
    const { id } = await params;
    step = "params parsed";
    console.log("[DELETE] Starting delete for member id:", id);

    // Check if member exists
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, displayName: true, lineUserId: true },
    });
    step = "member lookup";
    console.log("[DELETE] Member found:", member ? "yes" : "no");

    if (!member) {
      return NextResponse.json(
        { error: "Member not found", step },
        { status: 404 }
      );
    }

    // Delete related data first (due to foreign key constraints)
    // Use extended timeout (30 seconds) for members with lots of data
    await prisma.$transaction(async (tx) => {
      step = "tx:mealLog";
      await tx.mealLog.deleteMany({ where: { memberId: id } });
      
      step = "tx:weightLog";
      await tx.weightLog.deleteMany({ where: { memberId: id } });
      
      step = "tx:waterLog";
      await tx.waterLog.deleteMany({ where: { memberId: id } });
      
      step = "tx:exerciseLog";
      await tx.exerciseLog.deleteMany({ where: { memberId: id } });
      
      step = "tx:progressPhoto";
      await tx.progressPhoto.deleteMany({ where: { memberId: id } });
      
      step = "tx:aiRecommendation";
      await tx.aiRecommendation.deleteMany({ where: { memberId: id } });
      
      step = "tx:aiUsageLog";
      await tx.aiUsageLog.deleteMany({ where: { memberId: id } });
      
      step = "tx:barcodeScanHistory";
      await tx.barcodeScanHistory.deleteMany({ where: { memberId: id } });
      
      step = "tx:cartItem";
      await tx.cartItem.deleteMany({ where: { memberId: id } });
      
      step = "tx:address";
      await tx.address.deleteMany({ where: { memberId: id } });
      
      // Delete order items first, then orders (use single query for efficiency)
      step = "tx:orderItems";
      const orders = await tx.order.findMany({ where: { memberId: id }, select: { id: true } });
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      
      step = "tx:order";
      await tx.order.deleteMany({ where: { memberId: id } });
      
      step = "tx:member";
      await tx.member.delete({ where: { id } });
    }, {
      maxWait: 10000, // 10 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds timeout for the transaction
    });

    step = "complete";
    console.log("[DELETE] Successfully deleted member:", member.displayName || member.lineUserId);
    return NextResponse.json({ 
      success: true, 
      message: `Member ${member.displayName || member.lineUserId} deleted successfully` 
    });
  } catch (error) {
    console.error("[DELETE] Error at step:", step, "Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete member", step, details: errorMessage },
      { status: 500 }
    );
  }
}
