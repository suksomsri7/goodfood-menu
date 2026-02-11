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
        lastActiveAt: new Date(),
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
        // Activity tracking - start as inactive until onboarding is complete
        activityStatus: "inactive",
        lastActiveAt: new Date(),
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

    // Check if member was inactive and needs Welcome Back modal
    // Only show welcome back for ONBOARDED users who became inactive
    const wasInactive = member.activityStatus === "inactive" && member.isOnboarded;
    const showWelcomeBack = wasInactive && !member.welcomeBackShown;

    // Update lastActiveAt and change status if returning from inactive
    const updateData: Record<string, unknown> = {
      lastActiveAt: new Date(),
    };

    if (wasInactive) {
      // Onboarded member is returning from inactive status
      updateData.activityStatus = "active";
      updateData.inactiveSince = null;
      
      // Mark welcomeBackShown as true so modal shows only once
      if (!member.welcomeBackShown) {
        updateData.welcomeBackShown = true;
      }
    } else if (member.isOnboarded && member.activityStatus === "active") {
      // Reset welcomeBackShown for active onboarded members (for next inactive cycle)
      if (member.welcomeBackShown) {
        updateData.welcomeBackShown = false;
      }
    }
    // Note: New users (not onboarded) stay "inactive" until they complete onboarding

    // Update member activity
    await prisma.member.update({
      where: { lineUserId },
      data: updateData,
    });

    return NextResponse.json({
      ...member,
      showWelcomeBack, // Flag to show Welcome Back modal on frontend
    });
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
