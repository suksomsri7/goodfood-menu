import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get meal logs for a user on a specific date
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

    // Get member
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
      // Parse client timezone offset (negative for UTC+, positive for UTC-)
      // e.g., Thailand UTC+7 = -420 minutes
      const tzOffset = tzOffsetStr ? parseInt(tzOffsetStr, 10) : 0;
      
      // Create start/end of day in client's local timezone
      // dateStr is already in client's local date (YYYY-MM-DD)
      // We need to find UTC times that correspond to midnight-midnight in client timezone
      
      // Parse the date parts
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Create date at midnight UTC, then adjust for timezone
      // If tzOffset is -420 (UTC+7), midnight local = 17:00 previous day UTC
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

    const meals = await prisma.mealLog.findMany({
      where: {
        memberId: member.id,
        ...dateFilter,
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(meals);
  } catch (error) {
    console.error("Failed to get meals:", error);
    return NextResponse.json(
      { error: "Failed to get meals" },
      { status: 500 }
    );
  }
}

// POST - Add a new meal log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lineUserId,
      name,
      weight,
      multiplier = 1,
      calories,
      protein,
      carbs,
      fat,
      sodium,
      sugar,
      imageUrl,
      ingredients,
      date,
    } = body;

    if (!lineUserId || !name || calories === undefined) {
      return NextResponse.json(
        { error: "lineUserId, name, and calories are required" },
        { status: 400 }
      );
    }

    // Get or create member
    let member = await prisma.member.findUnique({
      where: { lineUserId },
    });

    if (!member) {
      member = await prisma.member.create({
        data: {
          lineUserId,
          dailyCalories: 2000,
          dailyProtein: 150,
          dailyCarbs: 250,
          dailyFat: 65,
        },
      });
    }

    const meal = await prisma.mealLog.create({
      data: {
        memberId: member.id,
        name,
        weight,
        multiplier,
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        sodium,
        sugar,
        imageUrl,
        ingredients,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Invalidate AI recommendation cache (trigger regenerate on next fetch)
    try {
      await prisma.aiRecommendation.deleteMany({
        where: { memberId: member.id },
      });
    } catch (e) {
      // Ignore error if recommendation doesn't exist
    }

    return NextResponse.json(meal);
  } catch (error) {
    console.error("Failed to add meal:", error);
    return NextResponse.json(
      { error: "Failed to add meal" },
      { status: 500 }
    );
  }
}
