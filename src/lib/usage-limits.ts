import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCreditCosts, type CreditCosts, type CreditKey } from "@/lib/aiCredits";

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

/**
 * action ไหนหักเครดิตช่องไหน (โหมด combined)
 * หมายเหตุ: dailyAiRecommendLimit ใช้ร่วมกัน 2 งาน — "คำแนะนำ" (recommend) กับ "สร้างแผน 7 วัน" (plan)
 * ซึ่งราคาไม่เท่ากัน → ฝั่ง plan/generate ส่ง creditKey: "plan" มาทับเอง
 */
const LIMIT_TO_CREDIT: Record<LimitType, CreditKey> = {
  dailyPhotoLimit: "photo",
  dailyAiAnalysisLimit: "photo",
  dailyAiTextAnalysisLimit: "textAnalysis",
  dailyAiRecommendLimit: "recommend",
  dailyExerciseAnalysisLimit: "exerciseAnalysis",
  dailyMenuSelectLimit: "menuSelect",
  dailyScanLimit: "barcode",
  dailyChatLimit: "chat",
};

export type CreditOpts = { creditKey?: CreditKey };

interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
  isCombinedMode?: boolean;
  /** โหมด combined: ครั้งนี้จะหักกี่เครดิต */
  cost?: number;
  creditKey?: CreditKey;
}

export const CREDITS_EXHAUSTED_MESSAGE =
  "เครดิต AI วันนี้หมดแล้ว จะได้ใหม่ตอนเที่ยงคืน — บันทึกเองยังใช้ได้ไม่จำกัดครับ";

/**
 * เครดิตยังเหลือ แต่ไม่พอค่างานชิ้นนี้ (เช่น เหลือ 2 แต่สร้างแผน 7 วัน = 5)
 * ห้ามบอก "หมดแล้ว" ทั้งที่ยังคุยกับโค้ชต่อได้ — user จะงงว่าตกลงหมดหรือไม่หมด
 */
function notEnoughMessage(remaining: number, cost: number) {
  return `งานนี้ใช้ ${cost} เครดิต แต่วันนี้เหลือ ${remaining} — เครดิตจะได้ใหม่ตอนเที่ยงคืนครับ`;
}

/**
 * ตอบกลับตอนโควตาหมด — ทุก endpoint ที่เรียก AI ใช้ตัวนี้ตัวเดียว
 * 🔴 คนละเรื่องกับ "ระบบ AI ล่ม/เครดิต OpenRouter หมด" (อันนั้น 503 + reason จาก aiOutageReason)
 */
export function creditsExhaustedResponse(q: UsageCheckResult, extra?: Record<string, unknown>) {
  const combined = q.isCombinedMode === true;
  return NextResponse.json(
    {
      error: combined ? "credits_exhausted" : "limit_reached",
      message: combined ? q.message ?? CREDITS_EXHAUSTED_MESSAGE : q.message,
      remaining: combined ? q.remaining : 0,
      limit: q.limit,
      used: q.used,
      cost: q.cost,
      limitReached: true, // ของเดิม (หน้า LIFF/แอปรุ่นก่อนอ่าน field นี้)
      ...extra,
    },
    { status: 429 }
  );
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

/** เที่ยงคืนไทยถัดไป (เวลาที่เครดิตรีเซ็ต) */
export function nextResetAt(): Date {
  const { startOfDay } = getTodayRange();
  return new Date(startOfDay.getTime() + 24 * 3600 * 1000);
}

/** เครดิตที่ใช้ไปแล้ววันนี้ (BKK) — รวมน้ำหนักทุก action */
async function creditsUsedToday(memberId: string): Promise<number> {
  const { startOfDay, endOfDay } = getTodayRange();
  const agg = await prisma.aiUsageLog.aggregate({
    where: {
      memberId,
      usageType: { in: allAiUsageTypes },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    _sum: { credits: true },
  });
  return agg._sum.credits ?? 0;
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
  limitType: LimitType,
  opts?: CreditOpts
): Promise<UsageCheckResult> {
  try {
    const memberType = member.memberType;
    const aiLimitMode = memberType?.aiLimitMode ?? "by_type";
    const { startOfDay, endOfDay } = getTodayRange();

    if (aiLimitMode === "combined") {
      const raw = memberType?.totalDailyAiLimit ?? 15;
      const totalLimit = raw === 0 ? UNLIMITED_SAFETY_CEILING : raw;
      const costs = await getCreditCosts();
      const creditKey = opts?.creditKey ?? LIMIT_TO_CREDIT[limitType];
      const cost = costs[creditKey] ?? 1;
      const totalUsed = await creditsUsedToday(member.id);
      const remaining = Math.max(0, totalLimit - totalUsed);
      // ต้องมีเครดิตพอ "ทั้งก้อน" ของ action นี้ ไม่ใช่แค่เหลือ > 0
      const allowed = cost === 0 || totalUsed + cost <= totalLimit;
      return {
        allowed,
        limit: totalLimit,
        used: totalUsed,
        remaining,
        message: allowed ? undefined : remaining > 0 ? notEnoughMessage(remaining, cost) : CREDITS_EXHAUSTED_MESSAGE,
        isCombinedMode: true,
        cost,
        creditKey,
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

/**
 * บันทึกการใช้ AI ด้วย memberId ตรง ๆ (native)
 * 🔴 เรียก "หลัง AI ตอบสำเร็จ" เท่านั้น — AI ล่ม/เครดิต OpenRouter หมด/parse ไม่ผ่าน = ห้ามหักเครดิต user
 */
export async function logAiUsageByMemberId(
  memberId: string,
  limitType: LimitType,
  opts?: CreditOpts
): Promise<void> {
  try {
    const costs = await getCreditCosts();
    const creditKey = opts?.creditKey ?? LIMIT_TO_CREDIT[limitType];
    await prisma.aiUsageLog.create({
      data: {
        memberId,
        usageType: usageTypeMap[limitType],
        creditKey,
        credits: costs[creditKey] ?? 1,
      },
    });
  } catch (error) {
    console.error("Error logging AI usage (member):", error);
  }
}

/** ยอดเครดิตคงเหลือของ member — ใช้ที่ GET /api/coach/credits และ /api/cal/initial-data */
export async function getCreditSnapshot(member: {
  id: string;
  memberType: { name?: string; color?: string; aiLimitMode?: string | null; totalDailyAiLimit?: number | null } | null;
}): Promise<{
  mode: "combined" | "by_type";
  limit: number;
  used: number;
  remaining: number;
  costs: CreditCosts;
  typeName: string | null;
  typeColor: string | null;
  resetAt: string;
}> {
  const mt = member.memberType;
  const mode = (mt?.aiLimitMode ?? "by_type") === "combined" ? "combined" : "by_type";
  const costs = await getCreditCosts();
  const raw = mt?.totalDailyAiLimit ?? 15;
  const limit = raw === 0 ? UNLIMITED_SAFETY_CEILING : raw;
  const used = await creditsUsedToday(member.id).catch(() => 0);
  return {
    mode,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    costs,
    typeName: mt?.name ?? null,
    typeColor: mt?.color ?? null,
    resetAt: nextResetAt().toISOString(),
  };
}

// Check if user can perform an action based on their member type limits
export async function checkUsageLimit(
  lineUserId: string,
  limitType: LimitType,
  opts?: CreditOpts
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

    // Combined mode: กระเป๋าเครดิตรวมต่อวัน (หักตามน้ำหนักของแต่ละ action)
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

      const costs = await getCreditCosts();
      const creditKey = opts?.creditKey ?? LIMIT_TO_CREDIT[limitType];
      const cost = costs[creditKey] ?? 1;
      const totalUsed = await creditsUsedToday(member.id);
      const remaining = Math.max(0, totalLimit - totalUsed);
      const allowed = cost === 0 || totalUsed + cost <= totalLimit;

      return {
        allowed,
        limit: totalLimit,
        used: totalUsed,
        remaining,
        message: allowed ? undefined : remaining > 0 ? notEnoughMessage(remaining, cost) : CREDITS_EXHAUSTED_MESSAGE,
        isCombinedMode: true,
        cost,
        creditKey,
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
  limitType: LimitType,
  opts?: CreditOpts
): Promise<void> {
  try {
    const member = await prisma.member.findUnique({
      where: { lineUserId },
      select: { id: true },
    });

    if (!member) return;

    await logAiUsageByMemberId(member.id, limitType, opts);
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
