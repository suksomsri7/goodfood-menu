import { prisma } from "@/lib/prisma";

export type LimitType = 
  | "dailyPhotoLimit"
  | "dailyAiAnalysisLimit"
  | "dailyAiTextAnalysisLimit"
  | "dailyAiRecommendLimit"
  | "dailyExerciseAnalysisLimit"
  | "dailyMenuSelectLimit"
  | "dailyScanLimit";

// Map limit type to usage type
const usageTypeMap: Record<LimitType, string> = {
  dailyPhotoLimit: "photo",
  dailyAiAnalysisLimit: "ai_analysis",
  dailyAiTextAnalysisLimit: "ai_text_analysis",
  dailyAiRecommendLimit: "ai_recommend",
  dailyExerciseAnalysisLimit: "exercise_analysis",
  dailyMenuSelectLimit: "menu_select",
  dailyScanLimit: "scan",
};

interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
}

// Get today's start and end timestamps (Thai timezone)
function getTodayRange() {
  // Use Thai timezone (UTC+7)
  const now = new Date();
  const thaiOffset = 7 * 60; // 7 hours in minutes
  const thaiNow = new Date(now.getTime() + thaiOffset * 60 * 1000);
  
  const startOfDay = new Date(thaiNow);
  startOfDay.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  const startUTC = new Date(startOfDay.getTime() - thaiOffset * 60 * 1000);
  
  const endOfDay = new Date(thaiNow);
  endOfDay.setUTCHours(23, 59, 59, 999);
  // Convert back to UTC
  const endUTC = new Date(endOfDay.getTime() - thaiOffset * 60 * 1000);
  
  return { startOfDay: startUTC, endOfDay: endUTC };
}

// Check if user can perform an action based on their member type limits
export async function checkUsageLimit(
  lineUserId: string,
  limitType: LimitType
): Promise<UsageCheckResult> {
  try {
    // Get member with memberType
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      include: { memberType: true },
    });

    if (!member) {
      return {
        allowed: false,
        limit: 0,
        used: 0,
        remaining: 0,
        message: "ไม่พบข้อมูลสมาชิก",
      };
    }

    // If no member type, use default limits
    const limit = member.memberType?.[limitType] ?? 3;

    // 0 means unlimited
    if (limit === 0) {
      return {
        allowed: true,
        limit: 0,
        used: 0,
        remaining: Infinity,
      };
    }

    const { startOfDay, endOfDay } = getTodayRange();
    const usageType = usageTypeMap[limitType];

    // Count today's usage from AiUsageLog
    const used = await prisma.aiUsageLog.count({
      where: {
        memberId: member.id,
        usageType: usageType,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    return {
      allowed,
      limit,
      used,
      remaining,
      message: allowed ? undefined : `ถึงขีดจำกัดการใช้งานวันนี้แล้ว (${limit} ครั้ง/วัน)`,
    };
  } catch (error) {
    console.error("Error checking usage limit:", error);
    return {
      allowed: true, // Allow on error to not block user
      limit: 0,
      used: 0,
      remaining: 0,
    };
  }
}

// Log AI usage after successful API call
export async function logAiUsage(
  lineUserId: string,
  limitType: LimitType
): Promise<void> {
  try {
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      select: { id: true },
    });

    if (!member) return;

    const usageType = usageTypeMap[limitType];

    await prisma.aiUsageLog.create({
      data: {
        memberId: member.id,
        usageType: usageType,
      },
    });
  } catch (error) {
    console.error("Error logging AI usage:", error);
  }
}

// Get all usage limits for a member
export async function getAllUsageLimits(lineUserId: string) {
  const member = await prisma.member.findUnique({
    where: { lineUserId },
    include: { memberType: true },
  });

  if (!member || !member.memberType) {
    return null;
  }

  const limits: Record<LimitType, UsageCheckResult> = {} as Record<LimitType, UsageCheckResult>;
  
  const limitTypes: LimitType[] = [
    "dailyPhotoLimit",
    "dailyAiAnalysisLimit",
    "dailyAiTextAnalysisLimit",
    "dailyAiRecommendLimit",
    "dailyExerciseAnalysisLimit",
    "dailyMenuSelectLimit",
    "dailyScanLimit",
  ];

  for (const limitType of limitTypes) {
    limits[limitType] = await checkUsageLimit(lineUserId, limitType);
  }

  return limits;
}
