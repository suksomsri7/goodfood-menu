import { prisma } from "@/lib/prisma";

export type LimitType = 
  | "dailyPhotoLimit"
  | "dailyAiAnalysisLimit"
  | "dailyAiTextAnalysisLimit"
  | "dailyAiRecommendLimit"
  | "dailyExerciseAnalysisLimit"
  | "dailyMenuSelectLimit"
  | "dailyScanLimit";

interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
}

// Get today's start and end timestamps
function getTodayRange() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
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
    let used = 0;

    // Count today's usage based on limit type
    switch (limitType) {
      case "dailyPhotoLimit":
      case "dailyAiAnalysisLimit":
      case "dailyAiTextAnalysisLimit":
        // Count meal logs created today
        used = await prisma.mealLog.count({
          where: {
            memberId: member.id,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });
        break;

      case "dailyAiRecommendLimit":
        // Count AI recommendations today
        const recommendation = await prisma.aiRecommendation.findUnique({
          where: { memberId: member.id },
        });
        if (recommendation && recommendation.date >= startOfDay && recommendation.date <= endOfDay) {
          used = recommendation.requestCount;
        }
        break;

      case "dailyExerciseAnalysisLimit":
        // Count exercise logs created today
        used = await prisma.exerciseLog.count({
          where: {
            memberId: member.id,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });
        break;

      case "dailyMenuSelectLimit":
        // For menu select, we'll track separately (could add a new table or use a different approach)
        // For now, allow based on general pattern
        used = 0; // Will implement proper tracking if needed
        break;

      case "dailyScanLimit":
        // Count barcode scans today
        used = await prisma.barcodeScanHistory.count({
          where: {
            memberId: member.id,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });
        break;
    }

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
