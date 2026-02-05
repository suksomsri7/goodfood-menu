import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Common exercise types with estimated calories per minute
const EXERCISE_CALORIES: Record<string, number> = {
  // Cardio
  "วิ่ง": 10,
  "เดินเร็ว": 5,
  "ปั่นจักรยาน": 8,
  "ว่ายน้ำ": 9,
  "กระโดดเชือก": 12,
  "เต้นแอโรบิค": 7,
  "เดินขึ้นบันได": 8,
  // Strength
  "ยกน้ำหนัก": 6,
  "วิดพื้น": 7,
  "สควอท": 6,
  "แพลงค์": 4,
  // Sports
  "แบดมินตัน": 7,
  "เทนนิส": 8,
  "บาสเกตบอล": 8,
  "ฟุตบอล": 9,
  // Flexibility
  "โยคะ": 3,
  "ยืดเหยียด": 2,
  // Default
  "อื่นๆ": 5,
};

// GET - Get exercise logs for a user on a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD (local date from client)
    const tzOffsetStr = searchParams.get("tzOffset"); // Client timezone offset in minutes

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Build date filter with timezone awareness
    let dateFilter = {};
    if (dateStr) {
      const tzOffset = tzOffsetStr ? parseInt(tzOffsetStr, 10) : 0;
      const [year, month, day] = dateStr.split('-').map(Number);
      
      const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      startOfDayUTC.setUTCMinutes(startOfDayUTC.getUTCMinutes() + tzOffset);
      
      const endOfDayUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      endOfDayUTC.setUTCMinutes(endOfDayUTC.getUTCMinutes() + tzOffset);
      
      dateFilter = {
        date: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
      };
    }

    const exercises = await prisma.exerciseLog.findMany({
      where: {
        memberId: member.id,
        ...dateFilter,
      },
      orderBy: { date: "desc" },
    });

    // Calculate total calories burned
    const totalBurned = exercises.reduce((sum, ex) => sum + ex.calories, 0);

    return NextResponse.json({ exercises, totalBurned });
  } catch (error) {
    console.error("Failed to get exercises:", error);
    return NextResponse.json(
      { error: "Failed to get exercises" },
      { status: 500 }
    );
  }
}

// POST - Add a new exercise log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lineUserId,
      name,
      type,
      duration, // minutes
      calories, // optional - if not provided, will be calculated
      intensity,
      note,
      date,
    } = body;

    if (!lineUserId || !name || !duration) {
      return NextResponse.json(
        { error: "lineUserId, name, and duration are required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Calculate calories if not provided
    let calculatedCalories = calories;
    if (!calculatedCalories) {
      const baseRate = EXERCISE_CALORIES[name] || EXERCISE_CALORIES["อื่นๆ"];
      // Adjust for intensity
      let intensityMultiplier = 1;
      if (intensity === "low") intensityMultiplier = 0.8;
      if (intensity === "high") intensityMultiplier = 1.3;
      
      calculatedCalories = Math.round(baseRate * duration * intensityMultiplier);
    }

    const exercise = await prisma.exerciseLog.create({
      data: {
        memberId: member.id,
        name,
        type,
        duration,
        calories: calculatedCalories,
        intensity,
        note,
        date: date ? new Date(date) : new Date(),
      },
    });

    return NextResponse.json(exercise);
  } catch (error) {
    console.error("Failed to add exercise:", error);
    return NextResponse.json(
      { error: "Failed to add exercise" },
      { status: 500 }
    );
  }
}

// GET exercise types for dropdown
export async function OPTIONS() {
  return NextResponse.json({
    exerciseTypes: Object.keys(EXERCISE_CALORIES),
    caloriesPerMinute: EXERCISE_CALORIES,
  });
}
