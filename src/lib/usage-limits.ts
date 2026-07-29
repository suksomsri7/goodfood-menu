import { prisma } from "@/lib/prisma";

export type LimitType =
  | "dailyPhotoLimit"
  | "dailyAiAnalysisLimit"
  | "dailyAiTextAnalysisLimit"
  | "dailyAiRecommendLimit"
  | "dailyExerciseAnalysisLimit"
  | "dailyMenuSelectLimit"
  | "dailyScanLimit"
  | "dailyChatLimit";

// Map limit type to usage type
const usageTypeMap: Record<LimitType, string> = {
  dailyPhotoLimit: "photo",
  dailyAiAnalysisLimit: "ai_analysis",
  dailyAiTextAnalysisLimit: "ai_text_analysis",
  dailyAiRecommendLimit: "ai_recommend",
  dailyExerciseAnalysisLimit: "exercise_analysis",
  dailyMenuSelectLimit: "menu_select",
  dailyScanLimit: "scan",
  dailyChatLimit: "coach_chat",
};

// All AI-related usage types for combined mode
const allAiUsageTypes = [
  "photo",
  "ai_analysis",
  "ai_text_analysis",
  "ai_recommend",
  "exercise_analysis",
  "menu_select",
  "scan",
  "coach_chat",
];

interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
  isCombinedMode?: boolean;
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


type MemberWithType = {
  id: string;
  memberType: ({ aiLimitMode: string | null; totalDailyAiLimit: number | null } & Record<string, any>) | null;
};

/** เพดานกันเหตุ runaway เมื่อ admin ตั้ง 0 (=ไม่จำกัด) — สูงพอที่ผู้ใช้จริงไม่มีวันชน */
const UNLIMITED_SAFETY_CEILING = 300;

/**
 * เช็คโควตาจาก member ตรง ๆ (native JWT ไม่มี lineUserId)
 * semantics เดียวกับ checkUsageLimit เดิมทุกอย่าง ยกเว้น: limit 0 → ใช้เพดานกันเหตุแทน Infinity
 */
export async function checkUsageLimitForMember(
  member: MemberWithType,
  limitType: LimitType
): Promise<UsageCheckResult> {
  try {
    const memberType = member.memberType;
    const aiLimitMode = memberType?.aiLimitMode ?? "by_type";
    const { startOfDay, endOfDay } = getTodayRange();

    if (aiLimitMode === "combined") {
      const raw = memberType?.totalDailyAiLimit ?? 15;
      const totalLimit = raw === 0 ? UNLIMITED_SAFETY_CEILING : raw;
      const totalUsed = await prisma.aiUsageLog.count({
        where: {
          memberId: member.id,
          usageType: { in: allAiUsageTypes },
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      });
      const allowed = totalUsed < totalLimit;
      return {
        allowed,
        limit: totalLimit,
        used: totalUsed,
        remaining: Math.max(0, totalLimit - totalUsed),
        message: allowed ? undefined : `ถึงขีดจำกัดการใช้งาน AI วันนี้แล้ว (${totalLimit} ครั้ง/วัน รวมทุกประเภท)`,
        isCombinedMode: true,
      };
    }

    const rawLimit = (memberType as any)?.[limitType] ?? 3;
    const limit = rawLimit === 0 ? UNLIMITED_SAFETY_CEILING : rawLimit;
    const usageType = usageTypeMap[limitType];
    const used = await prisma.aiUsageLog.count({
      where: {
        memberId: member.id,
        usageType,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });
    const allowed = used < limit;
    return {
      allowed,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      message: allowed ? undefined : `ถึงขีดจำกัดการใช้งานวันนี้แล้ว (${limit} ครั้ง/วัน)`,
      isCombinedMode: false,
    };
  } catch (error) {
    console.error("Error checking usage limit (member):", error);
    return { allowed: true, limit: 0, used: 0, remaining: 0 }; // เน็ต/DB มีปัญหา อย่า block user
  }
}

/** บันทึกการใช้ AI ด้วย memberId ตรง ๆ (native) */
export async function logAiUsageByMemberId(memberId: string, limitType: LimitType): Promise<void> {
  try {
    await prisma.aiUsageLog.create({ data: { memberId, usageType: usageTypeMap[limitType] } });
  } catch (error) {
    console.error("Error logging AI usage (member):", error);
  }
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

    const memberType = member.memberType;
    const aiLimitMode = memberType?.aiLimitMode ?? "by_type";
    const { startOfDay, endOfDay } = getTodayRange();

    // Combined mode: count all AI usage types together
    if (aiLimitMode === "combined") {
      const totalLimit = memberType?.totalDailyAiLimit ?? 15;
      
      // 0 means unlimited
      if (totalLimit === 0) {
        return {
          allowed: true,
          limit: 0,
          used: 0,
          remaining: Infinity,
          isCombinedMode: true,
        };
      }

      // Count all AI usage types for today
      const totalUsed = await prisma.aiUsageLog.count({
        where: {
          memberId: member.id,
          usageType: {
            in: allAiUsageTypes,
          },
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      const remaining = Math.max(0, totalLimit - totalUsed);
      const allowed = totalUsed < totalLimit;

      return {
        allowed,
        limit: totalLimit,
        used: totalUsed,
        remaining,
        message: allowed ? undefined : `ถึงขีดจำกัดการใช้งาน AI วันนี้แล้ว (${totalLimit} ครั้ง/วัน รวมทุกประเภท)`,
        isCombinedMode: true,
      };
    }

    // By type mode: use individual limits
    const limit = memberType?.[limitType] ?? 3;

    // 0 means unlimited
    if (limit === 0) {
      return {
        allowed: true,
        limit: 0,
        used: 0,
        remaining: Infinity,
        isCombinedMode: false,
      };
    }

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
      isCombinedMode: false,
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

  const aiLimitMode = member.memberType.aiLimitMode ?? "by_type";
  
  // If combined mode, just return one check since all types share the same limit
  if (aiLimitMode === "combined") {
    const combinedLimit = await checkUsageLimit(lineUserId, "dailyAiAnalysisLimit");
    return {
      mode: "combined" as const,
      combined: combinedLimit,
    };
  }

  // By type mode: return individual limits
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

  return {
    mode: "by_type" as const,
    limits,
  };
}
