import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายการประเภทสมาชิกทั้งหมด
export async function GET() {
  try {
    const memberTypes = await prisma.memberType.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return NextResponse.json(memberTypes);
  } catch (error) {
    console.error("Error fetching member types:", error);
    return NextResponse.json(
      { error: "Failed to fetch member types" },
      { status: 500 }
    );
  }
}

// POST - สร้างประเภทสมาชิกใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      color,
      dailyPhotoLimit,
      dailyAiAnalysisLimit,
      dailyAiTextAnalysisLimit,
      dailyAiRecommendLimit,
      dailyExerciseAnalysisLimit,
      dailyMenuSelectLimit,
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

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // ถ้าตั้งเป็น default ต้อง unset default อื่นก่อน
    if (isDefault) {
      await prisma.memberType.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // หา order สูงสุด
    const maxOrder = await prisma.memberType.aggregate({
      _max: { order: true },
    });

    const memberType = await prisma.memberType.create({
      data: {
        name,
        description: description || null,
        color: color || "#4CAF50",
        dailyPhotoLimit: dailyPhotoLimit ?? 3,
        dailyAiAnalysisLimit: dailyAiAnalysisLimit ?? 3,
        dailyAiTextAnalysisLimit: dailyAiTextAnalysisLimit ?? 3,
        dailyAiRecommendLimit: dailyAiRecommendLimit ?? 3,
        dailyExerciseAnalysisLimit: dailyExerciseAnalysisLimit ?? 3,
        dailyMenuSelectLimit: dailyMenuSelectLimit ?? 3,
        dailyScanLimit: dailyScanLimit ?? 5,
        isDefault: isDefault || false,
        isActive: isActive !== false,
        order: (maxOrder._max.order || 0) + 1,
        // AI Coach settings
        courseDuration: courseDuration ?? 7,
        morningCoachTime: morningCoachTime ?? "07:00",
        lunchReminderTime: lunchReminderTime ?? "11:30",
        dinnerReminderTime: dinnerReminderTime ?? "17:30",
        eveningSummaryTime: eveningSummaryTime ?? "20:00",
        waterReminderTimes: waterReminderTimes ?? "09:00,11:00,14:00,16:00",
        weeklyInsightsTime: weeklyInsightsTime ?? "09:00",
        inactiveReminderDays: inactiveReminderDays ?? 2,
      },
    });

    return NextResponse.json(memberType, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating member type:", error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "ชื่อประเภทสมาชิกนี้มีอยู่แล้ว" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create member type" },
      { status: 500 }
    );
  }
}
