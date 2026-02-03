import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Register or update member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, displayName, pictureUrl } = body;

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    // Upsert member
    const member = await prisma.member.upsert({
      where: { lineUserId },
      update: {
        displayName,
        pictureUrl,
        updatedAt: new Date(),
      },
      create: {
        lineUserId,
        displayName,
        pictureUrl,
        // Default goals
        dailyCalories: 2000,
        dailyProtein: 150,
        dailyCarbs: 250,
        dailyFat: 65,
        dailySodium: 2300,
        dailySugar: 50,
        dailyWater: 2000,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Failed to register member:", error);
    return NextResponse.json(
      { error: "Failed to register member" },
      { status: 500 }
    );
  }
}

// GET - Get current member by lineUserId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { lineUserId },
      include: {
        _count: {
          select: {
            mealLogs: true,
            orders: true,
          },
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
    console.error("Failed to get member:", error);
    return NextResponse.json(
      { error: "Failed to get member" },
      { status: 500 }
    );
  }
}

// PATCH - Update member profile/goals
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, ...updateData } = body;

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.update({
      where: { lineUserId },
      data: updateData,
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Failed to update member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}
