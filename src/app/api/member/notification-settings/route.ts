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
        notifyWaterReminder: true,
        notifyProgressPhoto: true,
        notifyPostExercise: true,
        notificationsPausedUntil: true,
        courseStartDate: true,
        memberType: {
          select: {
            id: true,
            name: true,
            courseDuration: true,
            morningCoachTime: true,
            lunchReminderTime: true,
            dinnerReminderTime: true,
            eveningSummaryTime: true,
            waterReminderTimes: true,
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

    // Calculate course progress
    let courseProgress = null;
    if (member.courseStartDate && member.memberType) {
      const daysSinceStart = Math.floor(
        (Date.now() - member.courseStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const currentDay = daysSinceStart + 1;
      const progress = Math.min(100, Math.round((currentDay / member.memberType.courseDuration) * 100));
      
      courseProgress = {
        currentDay,
        totalDays: member.memberType.courseDuration,
        progress,
        isActive: currentDay <= member.memberType.courseDuration,
      };
    }

    return NextResponse.json({
      settings: {
        morningCoach: member.notifyMorningCoach,
        eveningSummary: member.notifyEveningSummary,
        weeklyInsights: member.notifyWeeklyInsights,
        lunchSuggestion: member.notifyLunchSuggestion,
        dinnerSuggestion: member.notifyDinnerSuggestion,
        waterReminder: member.notifyWaterReminder,
        progressPhoto: member.notifyProgressPhoto,
        postExercise: member.notifyPostExercise,
        pausedUntil: member.notificationsPausedUntil,
      },
      schedule: member.memberType ? {
        morningCoachTime: member.memberType.morningCoachTime,
        lunchReminderTime: member.memberType.lunchReminderTime,
        dinnerReminderTime: member.memberType.dinnerReminderTime,
        eveningSummaryTime: member.memberType.eveningSummaryTime,
        waterReminderTimes: member.memberType.waterReminderTimes.split(","),
        weeklyInsightsTime: member.memberType.weeklyInsightsTime,
      } : null,
      course: courseProgress,
      memberType: member.memberType ? {
        id: member.memberType.id,
        name: member.memberType.name,
      } : null,
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
      waterReminder,
      progressPhoto,
      postExercise,
      pauseForDays, // Number of days to pause all notifications
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (morningCoach !== undefined) updateData.notifyMorningCoach = morningCoach;
    if (eveningSummary !== undefined) updateData.notifyEveningSummary = eveningSummary;
    if (weeklyInsights !== undefined) updateData.notifyWeeklyInsights = weeklyInsights;
    if (lunchSuggestion !== undefined) updateData.notifyLunchSuggestion = lunchSuggestion;
    if (dinnerSuggestion !== undefined) updateData.notifyDinnerSuggestion = dinnerSuggestion;
    if (waterReminder !== undefined) updateData.notifyWaterReminder = waterReminder;
    if (progressPhoto !== undefined) updateData.notifyProgressPhoto = progressPhoto;
    if (postExercise !== undefined) updateData.notifyPostExercise = postExercise;

    // Handle pause
    if (pauseForDays !== undefined) {
      if (pauseForDays === 0 || pauseForDays === null) {
        updateData.notificationsPausedUntil = null;
      } else {
        const pauseUntil = new Date();
        pauseUntil.setDate(pauseUntil.getDate() + pauseForDays);
        updateData.notificationsPausedUntil = pauseUntil;
      }
    }

    const member = await prisma.member.update({
      where: { lineUserId },
      data: updateData,
      select: {
        notifyMorningCoach: true,
        notifyEveningSummary: true,
        notifyWeeklyInsights: true,
        notifyLunchSuggestion: true,
        notifyDinnerSuggestion: true,
        notifyWaterReminder: true,
        notifyProgressPhoto: true,
        notifyPostExercise: true,
        notificationsPausedUntil: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        morningCoach: member.notifyMorningCoach,
        eveningSummary: member.notifyEveningSummary,
        weeklyInsights: member.notifyWeeklyInsights,
        lunchSuggestion: member.notifyLunchSuggestion,
        dinnerSuggestion: member.notifyDinnerSuggestion,
        waterReminder: member.notifyWaterReminder,
        progressPhoto: member.notifyProgressPhoto,
        postExercise: member.notifyPostExercise,
        pausedUntil: member.notificationsPausedUntil,
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
