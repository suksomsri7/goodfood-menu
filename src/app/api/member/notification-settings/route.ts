import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get member notification settings
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
      select: {
        id: true,
        notifyMorningCoach: true,
        notifyEveningSummary: true,
        notifyWeeklyInsights: true,
        notifyLunchSuggestion: true,
        notifyDinnerSuggestion: true,
        notifyProgressPhoto: true,
        notifyPostExercise: true,
        notificationsPausedUntil: true,
        aiCoachExpireDate: true,
        memberType: {
          select: {
            id: true,
            name: true,
            courseDuration: true,
            morningCoachTime: true,
            lunchReminderTime: true,
            dinnerReminderTime: true,
            eveningSummaryTime: true,
            weeklyInsightsTime: true,
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

    // Determine AI Coach status
    let aiCoachStatus: "not_assigned" | "active" | "expired" | "unlimited" = "not_assigned";
    let daysRemaining: number | null = null;
    
    if (member.memberType) {
      if (member.memberType.courseDuration === 0) {
        // Unlimited
        aiCoachStatus = "unlimited";
      } else if (member.aiCoachExpireDate) {
        const now = new Date();
        const expireDate = new Date(member.aiCoachExpireDate);
        if (expireDate > now) {
          aiCoachStatus = "active";
          daysRemaining = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          aiCoachStatus = "expired";
        }
      } else {
        // Has member type but no expire date set - treat as needs setup
        aiCoachStatus = "not_assigned";
      }
    }

    return NextResponse.json({
      settings: {
        morningCoach: member.notifyMorningCoach,
        eveningSummary: member.notifyEveningSummary,
        weeklyInsights: member.notifyWeeklyInsights,
        lunchSuggestion: member.notifyLunchSuggestion,
        dinnerSuggestion: member.notifyDinnerSuggestion,
        progressPhoto: member.notifyProgressPhoto,
        postExercise: member.notifyPostExercise,
        pausedUntil: member.notificationsPausedUntil,
      },
      schedule: member.memberType ? {
        morningCoachTime: member.memberType.morningCoachTime,
        lunchReminderTime: member.memberType.lunchReminderTime,
        dinnerReminderTime: member.memberType.dinnerReminderTime,
        eveningSummaryTime: member.memberType.eveningSummaryTime,
        weeklyInsightsTime: member.memberType.weeklyInsightsTime,
      } : null,
      aiCoach: {
        status: aiCoachStatus,
        expireDate: member.aiCoachExpireDate,
        daysRemaining,
        memberTypeName: member.memberType?.name || null,
        courseDuration: member.memberType?.courseDuration || null,
      },
    });
  } catch (error) {
    console.error("Error getting notification settings:", error);
    return NextResponse.json(
      { error: "Failed to get notification settings" },
      { status: 500 }
    );
  }
}

// PUT - Update member notification settings
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json(
        { error: "lineUserId is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      morningCoach,
      eveningSummary,
      weeklyInsights,
      lunchSuggestion,
      dinnerSuggestion,
      progressPhoto,
      postExercise,
    } = body;

    // Build update data (User can only update notification preferences, not expire date)
    const updateData: Record<string, unknown> = {};

    if (morningCoach !== undefined) updateData.notifyMorningCoach = morningCoach;
    if (eveningSummary !== undefined) updateData.notifyEveningSummary = eveningSummary;
    if (weeklyInsights !== undefined) updateData.notifyWeeklyInsights = weeklyInsights;
    if (lunchSuggestion !== undefined) updateData.notifyLunchSuggestion = lunchSuggestion;
    if (dinnerSuggestion !== undefined) updateData.notifyDinnerSuggestion = dinnerSuggestion;
    if (progressPhoto !== undefined) updateData.notifyProgressPhoto = progressPhoto;
    if (postExercise !== undefined) updateData.notifyPostExercise = postExercise;

    const member = await prisma.member.update({
      where: { lineUserId },
      data: updateData,
      select: {
        notifyMorningCoach: true,
        notifyEveningSummary: true,
        notifyWeeklyInsights: true,
        notifyLunchSuggestion: true,
        notifyDinnerSuggestion: true,
        notifyProgressPhoto: true,
        notifyPostExercise: true,
        notificationsPausedUntil: true,
        aiCoachExpireDate: true,
        memberType: {
          select: {
            id: true,
            name: true,
            courseDuration: true,
          },
        },
      },
    });

    // Determine AI Coach status
    let aiCoachStatus: "not_assigned" | "active" | "expired" | "unlimited" = "not_assigned";
    let daysRemaining: number | null = null;
    
    if (member.memberType) {
      if (member.memberType.courseDuration === 0) {
        aiCoachStatus = "unlimited";
      } else if (member.aiCoachExpireDate) {
        const now = new Date();
        const expireDate = new Date(member.aiCoachExpireDate);
        if (expireDate > now) {
          aiCoachStatus = "active";
          daysRemaining = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          aiCoachStatus = "expired";
        }
      }
    }

    return NextResponse.json({
      success: true,
      settings: {
        morningCoach: member.notifyMorningCoach,
        eveningSummary: member.notifyEveningSummary,
        weeklyInsights: member.notifyWeeklyInsights,
        lunchSuggestion: member.notifyLunchSuggestion,
        dinnerSuggestion: member.notifyDinnerSuggestion,
        progressPhoto: member.notifyProgressPhoto,
        postExercise: member.notifyPostExercise,
        pausedUntil: member.notificationsPausedUntil,
      },
      aiCoach: {
        status: aiCoachStatus,
        expireDate: member.aiCoachExpireDate,
        daysRemaining,
        memberTypeName: member.memberType?.name || null,
        courseDuration: member.memberType?.courseDuration || null,
      },
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}
