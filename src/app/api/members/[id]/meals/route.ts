import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงรายการอาหารของสมาชิก
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [meals, totalCount] = await Promise.all([
      prisma.mealLog.findMany({
        where: { memberId: id },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.mealLog.count({ where: { memberId: id } }),
    ]);

    // Calculate totals for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayMeals = await prisma.mealLog.findMany({
      where: {
        memberId: id,
        date: { gte: today, lt: tomorrow },
      },
    });

    const todayStats = {
      totalCalories: todayMeals.reduce((sum, m) => sum + m.calories, 0),
      totalProtein: todayMeals.reduce((sum, m) => sum + m.protein, 0),
      totalCarbs: todayMeals.reduce((sum, m) => sum + m.carbs, 0),
      totalFat: todayMeals.reduce((sum, m) => sum + m.fat, 0),
      mealCount: todayMeals.length,
    };

    return NextResponse.json({
      meals,
      todayStats,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching member meals:", error);
    return NextResponse.json(
      { error: "Failed to fetch member meals" },
      { status: 500 }
    );
  }
}
