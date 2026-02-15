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

    // Get AI usage statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total AI usage by type
    const totalByType = await prisma.aiUsageLog.groupBy({
      by: ['usageType'],
      where: { memberId: id },
      _count: { id: true },
    });

    // Get today's AI usage by type
    const todayByType = await prisma.aiUsageLog.groupBy({
      by: ['usageType'],
      where: { 
        memberId: id,
        createdAt: { gte: today },
      },
      _count: { id: true },
    });

    // Get recent AI usage logs (last 20)
    const recentLogs = await prisma.aiUsageLog.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Format AI usage stats
    const aiUsageStats = {
      total: totalByType.reduce((sum, t) => sum + t._count.id, 0),
      today: todayByType.reduce((sum, t) => sum + t._count.id, 0),
      byType: {
        total: Object.fromEntries(totalByType.map(t => [t.usageType, t._count.id])),
        today: Object.fromEntries(todayByType.map(t => [t.usageType, t._count.id])),
      },
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        usageType: log.usageType,
        createdAt: log.createdAt,
      })),
    };

    return NextResponse.json({
      ...member,
      aiUsageStats,
    });
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
    // Use extended timeout (30 seconds) for members with lots of data
    await prisma.$transaction(async (tx) => {
      await tx.mealLog.deleteMany({ where: { memberId: id } });
      await tx.weightLog.deleteMany({ where: { memberId: id } });
      await tx.waterLog.deleteMany({ where: { memberId: id } });
      await tx.exerciseLog.deleteMany({ where: { memberId: id } });
      await tx.progressPhoto.deleteMany({ where: { memberId: id } });
      await tx.aiRecommendation.deleteMany({ where: { memberId: id } });
      await tx.aiUsageLog.deleteMany({ where: { memberId: id } });
      await tx.barcodeScanHistory.deleteMany({ where: { memberId: id } });
      await tx.cartItem.deleteMany({ where: { memberId: id } });
      await tx.address.deleteMany({ where: { memberId: id } });
      
      // Delete order items first, then orders (use single query for efficiency)
      const orders = await tx.order.findMany({ where: { memberId: id }, select: { id: true } });
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      await tx.order.deleteMany({ where: { memberId: id } });
      
      // Finally delete the member
      await tx.member.delete({ where: { id } });
    }, {
      maxWait: 10000, // 10 seconds max wait to acquire connection
      timeout: 30000, // 30 seconds timeout for the transaction
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
