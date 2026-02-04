import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get meal logs for a user on a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD

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

    // Build date filter
    let dateFilter = {};
    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      
      dateFilter = {
        date: {
          gte: startOfDay,
          lte: endOfDay,
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
