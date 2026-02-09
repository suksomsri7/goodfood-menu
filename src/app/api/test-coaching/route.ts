import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { 
  sendCoachingMessage, 
  shouldSendNotification, 
  gatherMemberContext,
  CoachingType 
} from "@/lib/coaching";

// Test endpoint to verify all coaching notifications
// Usage: GET /api/test-coaching?lineUserId=xxx&type=exercise
// Or: GET /api/test-coaching?lineUserId=xxx&type=all (to test all types)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId");
  const type = searchParams.get("type") as CoachingType | "all" | null;
  const dryRun = searchParams.get("dryRun") === "true";

  if (!lineUserId) {
    return NextResponse.json(
      { error: "lineUserId is required" },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};

  try {
    // Step 1: Find member
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      include: { memberType: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found", lineUserId },
        { status: 404 }
      );
    }

    // Determine AI Coach status
    const isUnlimited = member.memberType?.courseDuration === 0;
    const isExpired = !isUnlimited && 
      (!member.aiCoachExpireDate || member.aiCoachExpireDate < new Date());
    const aiCoachStatus = !member.memberType 
      ? "not_assigned" 
      : isUnlimited 
        ? "unlimited" 
        : isExpired 
          ? "expired" 
          : "active";

    results.member = {
      id: member.id,
      name: member.displayName || member.name,
      lineUserId: member.lineUserId,
      aiCoachExpireDate: member.aiCoachExpireDate,
      aiCoachStatus,
      memberTypeId: member.memberTypeId,
      memberTypeName: member.memberType?.name,
      courseDuration: member.memberType?.courseDuration,
      isActive: member.isActive,
    };

    // Step 2: Check notification preferences
    results.notificationPrefs = {
      morning: member.notifyMorningCoach,
      evening: member.notifyEveningSummary,
      lunch: member.notifyLunchSuggestion,
      dinner: member.notifyDinnerSuggestion,
      weekly: member.notifyWeeklyInsights,
      photo: member.notifyProgressPhoto,
      exercise: member.notifyPostExercise,
      notificationsPausedUntil: member.notificationsPausedUntil,
    };

    // Step 3: Gather context
    const context = await gatherMemberContext(member.id);
    results.context = context ? {
      name: context.name,
      aiCoachActive: context.aiCoach.isActive,
      aiCoachUnlimited: context.aiCoach.isUnlimited,
      aiCoachDaysRemaining: context.aiCoach.daysRemaining,
      todayCalories: context.today.calories,
      todayMeals: context.today.meals,
      exerciseToday: context.exerciseToday,
      streakDays: context.streakDays,
    } : null;

    // Step 4: Check each notification type
    const allTypes: CoachingType[] = [
      "morning", "lunch", "dinner", "evening", 
      "weekly", "photo", "exercise", 
      "milestone", "inactive"
    ];

    const typesToTest = type === "all" ? allTypes : type ? [type] : allTypes;

    results.notifications = {};

    for (const notifType of typesToTest) {
      const shouldSend = await shouldSendNotification(member.id, notifType);
      
      (results.notifications as Record<string, unknown>)[notifType] = {
        shouldSend,
        prefEnabled: getNotifPref(member, notifType),
      };

      // If not dry run and should send, actually send the notification
      if (!dryRun && shouldSend && type && type !== "all") {
        try {
          const sent = await sendCoachingMessage(member.id, notifType);
          (results.notifications as Record<string, unknown>)[notifType] = {
            ...(results.notifications as Record<string, unknown>)[notifType] as object,
            sent,
            message: sent ? "Notification sent successfully!" : "Failed to send notification",
          };
        } catch (err) {
          (results.notifications as Record<string, unknown>)[notifType] = {
            ...(results.notifications as Record<string, unknown>)[notifType] as object,
            sent: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      }
    }

    // Step 5: Check environment
    results.environment = {
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasLiffUrl: !!process.env.LIFF_URL,
      liffUrl: process.env.LIFF_URL || "https://liff.line.me/2009033721-Ou7cdCtC (fallback)",
    };

    // Step 6: Diagnose issues
    const issues: string[] = [];
    
    if (!member.memberType) {
      issues.push("❌ ไม่ได้กำหนดประเภท AI Coach");
    } else if (aiCoachStatus === "expired") {
      issues.push("❌ AI Coach หมดอายุแล้ว");
    } else if (aiCoachStatus === "active" && member.aiCoachExpireDate) {
      const daysLeft = Math.ceil(
        (member.aiCoachExpireDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      issues.push(`✅ AI Coach ใช้งานได้ (เหลือ ${daysLeft} วัน)`);
    } else if (aiCoachStatus === "unlimited") {
      issues.push("✅ AI Coach ไม่จำกัดระยะเวลา");
    }
    if (!member.isActive) {
      issues.push("❌ สมาชิกไม่ active");
    }
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      issues.push("❌ LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า");
    }
    if (!process.env.OPENAI_API_KEY) {
      issues.push("⚠️ OPENAI_API_KEY ไม่ได้ตั้งค่า (จะใช้ fallback message)");
    }
    if (member.notificationsPausedUntil && member.notificationsPausedUntil > new Date()) {
      issues.push(`⚠️ การแจ้งเตือนถูกหยุดชั่วคราวถึง ${member.notificationsPausedUntil.toISOString()}`);
    }

    results.issues = issues.length > 0 ? issues : ["✅ ไม่พบปัญหา"];
    results.dryRun = dryRun;
    results.tip = dryRun 
      ? "เพิ่ม &dryRun=false เพื่อส่งแจ้งเตือนจริง" 
      : "กำลังส่งแจ้งเตือนจริง";

    return NextResponse.json(results);

  } catch (error) {
    console.error("Test coaching error:", error);
    return NextResponse.json(
      { 
        error: "Test failed", 
        message: error instanceof Error ? error.message : "Unknown error",
        results 
      },
      { status: 500 }
    );
  }
}

function getNotifPref(member: {
  notifyMorningCoach: boolean;
  notifyEveningSummary: boolean;
  notifyLunchSuggestion: boolean;
  notifyDinnerSuggestion: boolean;
  notifyWeeklyInsights: boolean;
  notifyProgressPhoto: boolean;
  notifyPostExercise: boolean;
}, type: CoachingType): boolean {
  const map: Record<CoachingType, boolean> = {
    morning: member.notifyMorningCoach,
    evening: member.notifyEveningSummary,
    lunch: member.notifyLunchSuggestion,
    dinner: member.notifyDinnerSuggestion,
    weekly: member.notifyWeeklyInsights,
    photo: member.notifyProgressPhoto,
    exercise: member.notifyPostExercise,
    milestone: true,
    inactive: true,
  };
  return map[type];
}
