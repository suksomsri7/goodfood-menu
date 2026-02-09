import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงข้อมูลประเภทสมาชิกตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const memberType = await prisma.memberType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!memberType) {
      return NextResponse.json(
        { error: "Member type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(memberType);
  } catch (error) {
    console.error("Error fetching member type:", error);
    return NextResponse.json(
      { error: "Failed to fetch member type" },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทประเภทสมาชิก
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      color,
      dailyPhotoLimit,
      dailyAiAnalysisLimit,
      dailyAiRecommendLimit,
      dailyScanLimit,
      isDefault,
      isActive,
      // AI Coach settings
      courseDuration,
      morningCoachTime,
      lunchReminderTime,
      dinnerReminderTime,
      eveningSummaryTime,
      waterReminderTimes,
      weeklyInsightsTime,
      inactiveReminderDays,
    } = body;

    // ถ้าตั้งเป็น default ต้อง unset default อื่นก่อน
    if (isDefault) {
      await prisma.memberType.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const memberType = await prisma.memberType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(dailyPhotoLimit !== undefined && { dailyPhotoLimit }),
        ...(dailyAiAnalysisLimit !== undefined && { dailyAiAnalysisLimit }),
        ...(dailyAiRecommendLimit !== undefined && { dailyAiRecommendLimit }),
        ...(dailyScanLimit !== undefined && { dailyScanLimit }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
        // AI Coach settings
        ...(courseDuration !== undefined && { courseDuration }),
        ...(morningCoachTime !== undefined && { morningCoachTime }),
        ...(lunchReminderTime !== undefined && { lunchReminderTime }),
        ...(dinnerReminderTime !== undefined && { dinnerReminderTime }),
        ...(eveningSummaryTime !== undefined && { eveningSummaryTime }),
        ...(waterReminderTimes !== undefined && { waterReminderTimes }),
        ...(weeklyInsightsTime !== undefined && { weeklyInsightsTime }),
        ...(inactiveReminderDays !== undefined && { inactiveReminderDays }),
      },
    });

    return NextResponse.json(memberType);
  } catch (error: unknown) {
    console.error("Error updating member type:", error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "ชื่อประเภทสมาชิกนี้มีอยู่แล้ว" },
        { status: 400 }
      );
    }
    
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Member type not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to update member type" },
      { status: 500 }
    );
  }
}

// DELETE - ลบประเภทสมาชิก
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ตรวจสอบว่ามีสมาชิกใช้ประเภทนี้อยู่หรือไม่
    const memberCount = await prisma.member.count({
      where: { memberTypeId: id },
    });

    if (memberCount > 0) {
      return NextResponse.json(
        { error: `ไม่สามารถลบได้ มีสมาชิก ${memberCount} คนใช้ประเภทนี้อยู่` },
        { status: 400 }
      );
    }

    await prisma.memberType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting member type:", error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Member type not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to delete member type" },
      { status: 500 }
    );
  }
}
