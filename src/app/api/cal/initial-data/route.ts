import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Combined API endpoint to fetch all initial data for /cal page in ONE request
// This reduces 4 API calls to 1, significantly improving initial load time

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    const tzOffset = parseInt(searchParams.get("tzOffset") || "0", 10);

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    // Find member first
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        dailyCalories: true,
        dailyProtein: true,
        dailyCarbs: true,
        dailyFat: true,
        dailySodium: true,
        dailySugar: true,
        dailyWater: true,
        bmr: true,
        tdee: true,
        goalType: true,
        weight: true,
        goalWeight: true,
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Calculate date range for today's data
    let startOfDay: Date;
    let endOfDay: Date;

    if (dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number);
      startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      startOfDay.setUTCMinutes(startOfDay.getUTCMinutes() + tzOffset);
      endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      endOfDay.setUTCMinutes(endOfDay.getUTCMinutes() + tzOffset);
    } else {
      startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Fetch meals, water, exercises in PARALLEL
    const [meals, waterResult, exercisesResult] = await Promise.all([
      // Meals for selected date
      prisma.mealLog.findMany({
        where: {
          memberId: member.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          name: true,
          weight: true,
          multiplier: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          sodium: true,
          sugar: true,
          imageUrl: true,
          ingredients: true,
          date: true,
        },
      }),

      // Water intake for selected date
      prisma.waterLog.aggregate({
        where: {
          memberId: member.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: { amount: true },
      }),

      // Exercises for selected date
      prisma.exerciseLog.findMany({
        where: {
          memberId: member.id,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          duration: true,
          calories: true,
          intensity: true,
          note: true,
          date: true,
        },
      }),
    ]);

    // Calculate totals
    const waterTotal = waterResult._sum.amount || 0;
    const exerciseBurned = exercisesResult.reduce((sum, ex) => sum + ex.calories, 0);

    const responseTime = Date.now() - startTime;

    // Build response
    const response = NextResponse.json({
      member,
      meals,
      water: {
        total: waterTotal,
      },
      exercises: {
        items: exercisesResult,
        totalBurned: exerciseBurned,
      },
      meta: {
        responseTime,
        date: dateStr || new Date().toISOString().split('T')[0],
      },
    });

    // Add cache headers - cache for 30 seconds, stale-while-revalidate for 60 seconds
    response.headers.set(
      "Cache-Control",
      "private, max-age=30, stale-while-revalidate=60"
    );

    return response;
  } catch (error) {
    console.error("Failed to get initial data:", error);
    return NextResponse.json(
      { error: "Failed to get initial data" },
      { status: 500 }
    );
  }
}
