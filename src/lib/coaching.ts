import { prisma } from "@/lib/prisma";
import { getDailyBudget } from "@/lib/dailyBudget";
import OpenAI from "openai";
import { buildOpenAI, aiModel } from "@/lib/aiClient";
import { getSecret } from "@/lib/secrets/store";
import { pushMessage, createFlexMessage } from "@/lib/line";
import { getPersonalizationSafe, type Personalization } from "@/lib/personalization";

// AI Coach System Prompt
export const COACH_SYSTEM_PROMPT = `คุณคือ "โค้ชกู๊ด" โค้ชโภชนาการส่วนตัวมืออาชีพจาก GoodFood

บุคลิกของคุณ:
- พูดจาเป็นกันเอง ใช้ "ครับ/ค่ะ" และเรียกชื่อลูกค้า
- ให้กำลังใจเสมอ แต่ไม่เยินยอเกินจริง
- ตรงไปตรงมา บอกจุดที่ต้องปรับปรุงอย่างสุภาพ
- ใช้ emoji พอประมาณ ไม่เยอะเกินไป
- ข้อความสั้นกระชับ อ่านง่าย

หลักการ:
1. วิเคราะห์ข้อมูลจริงเสมอ ไม่แต่งเรื่อง
2. ให้คำแนะนำที่ทำได้จริง เฉพาะเจาะจง
3. ติดตาม pattern/trend ของลูกค้า
4. จำสิ่งที่เกิดขึ้นในวันก่อนๆ
5. ปรับน้ำเสียงตามสถานการณ์ (ยินดี/เป็นห่วง/ให้กำลังใจ)

ห้าม:
- ใช้ข้อความซ้ำๆ เหมือนกันทุกวัน
- พูดเรื่องทั่วไปที่ไม่เกี่ยวกับข้อมูลลูกค้า
- ให้คำแนะนำที่ขัดแย้งกับเป้าหมายลูกค้า`;

export type CoachingType = 
  | "morning" 
  | "lunch" 
  | "dinner" 
  | "evening" 
  | "weekly" 
  | "photo" 
  | "exercise" 
  | "milestone" 
  | "inactive";

export interface MemberContext {
  name: string;
  goal: {
    type: string;
    currentWeight: number | null;
    targetWeight: number | null;
  };
  aiCoach: {
    isActive: boolean;
    isUnlimited: boolean;
    daysRemaining: number | null;
    expireDate: Date | null;
  };
  today: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealCount: number;
    meals: string[];
  };
  yesterday: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealCount: number;
  };
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  water: {
    current: number;
    target: number;
  };
  stock: Array<{
    name: string;
    calories: number;
    protein: number;
  }>;
  weightChange: number | null;
  exerciseToday: {
    name: string;
    calories: number;
  } | null;
  streakDays: number;
  /** งบแคลอรี่วันนี้แบบฐาน+คืน (dailyBudget.ts) */
  budget: {
    base: number; earned: number; target: number; remaining: number;
    week: { budget: number; used: number; remaining: number; daysLeft: number; perDayLeft: number; startLabel: string };
    explain: string;
  } | null;
  /** วง Move/Stand/Exercise ของ Apple (ผ่าน HealthKit) — ใช้เป็นบริบทให้โค้ช ไม่ได้โชว์เป็นวงในแอป */
  activity: {
    steps: number;
    activeKcal: number;
    standHours: number;
    exerciseMin: number;
    hasWatchData: boolean;
  };
  lastActiveAt: Date | null;
  // แผนวันนี้จาก DailyPlan (เฟส 2 — inject ก่อนเรียก generateCoachingMessage("morning"))
  todayPlan?: {
    exerciseTitle: string;
    exerciseMinutes: number;
    mealSummary: string; // สรุปมื้อ เช่น "เช้า: ข้าวต้มไข่ · กลางวัน: ..."
    totalKcal: number;
  } | null;
  // เตือนโซเดียม/น้ำตาลจากเมื่อวาน (เฟส 4 → ยัดเข้าโค้ชเช้า)
  warnings?: string[];
  // การปรับแผนอัตโนมัติล่าสุด (เฟส 5 → บอกในข้อความเช้า)
  planAdjustNote?: string | null;
  // WO-P.3 (สาย P) — CoachMemory + BehaviorInsight ของ user (จุดเดียว ทุก AI path ใช้ร่วมกัน)
  personalization: Personalization;
}

// Calculate expiry threshold using Thailand timezone
// If expiry is "Feb 12", member should be active throughout Feb 12 (Thailand time)
// Threshold = start of today Thailand in UTC
// Example: Feb 12 Thailand starts at Feb 11 17:00 UTC
function getExpiryThreshold(): Date {
  const now = new Date();
  const todayThailand = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const startOfTodayThailand = new Date(Date.UTC(
    todayThailand.getUTCFullYear(),
    todayThailand.getUTCMonth(),
    todayThailand.getUTCDate(),
    0, 0, 0, 0
  ));
  // Convert to UTC by subtracting 7 hours
  return new Date(startOfTodayThailand.getTime() - (7 * 60 * 60 * 1000));
}

// Check if AI Coach is active for member
export function isAiCoachActive(member: { 
  memberType: { courseDuration: number; isActive: boolean } | null; 
  aiCoachExpireDate: Date | null 
}): boolean {
  if (!member.memberType) return false;
  
  // Check if member type is active (admin can disable AI Coach for this type)
  if (!member.memberType.isActive) return false;
  
  // Unlimited (courseDuration = 0)
  if (member.memberType.courseDuration === 0) return true;
  
  // Check expire date using Thailand timezone
  // Expiry date "Feb 12" means member is active throughout Feb 12 (Thailand time)
  if (!member.aiCoachExpireDate) return false;
  const expiryThreshold = getExpiryThreshold();
  return member.aiCoachExpireDate >= expiryThreshold;
}

// Central gate: ดึง member (พร้อม memberType) จาก lineUserId + เช็คสิทธิ์ AI coach
// API route ใหม่ทุกตัวเรียกตัวนี้ ห้าม copy-paste logic (RESUME §2)
export async function requireAiCoach(lineUserId: string) {
  const member = await prisma.member.findUnique({
    where: { lineUserId },
    include: { memberType: true },
  });
  const active = member ? isAiCoachActive(member) : false;
  return { member, active };
}

// Check if member should receive notification
export async function shouldSendNotification(
  memberId: string,
  type: CoachingType
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { memberType: true },
  });

  console.log("[Coaching] shouldSendNotification:", { memberId, type, found: !!member });

  if (!member) return false;

  // Check if AI Coach is active
  if (!isAiCoachActive(member)) {
    console.log("[Coaching] AI Coach not active for member:", memberId);
    return false;
  }

  // Check if notifications are paused
  if (
    member.notificationsPausedUntil &&
    member.notificationsPausedUntil > new Date()
  ) {
    return false;
  }

  // Check notification preference by type
  const notificationMap: Record<CoachingType, boolean> = {
    morning: member.notifyMorningCoach,
    evening: member.notifyEveningSummary,
    lunch: member.notifyLunchSuggestion,
    dinner: member.notifyDinnerSuggestion,
    weekly: member.notifyWeeklyInsights,
    photo: member.notifyProgressPhoto,
    exercise: member.notifyPostExercise,
    milestone: true, // Always send milestones
    inactive: true, // Always send inactive reminders
  };

  if (!notificationMap[type]) {
    return false;
  }

  // Type-specific checks
  switch (type) {
    case "lunch":
      return !(await hasMealLogToday(memberId, "lunch"));
    case "dinner":
      return !(await hasMealLogToday(memberId, "dinner"));
    case "weekly":
    case "photo":
      return isWeeklyMilestoneFromCreated(member.createdAt);
    default:
      return true;
  }
}

// Check if user has logged a specific meal type today
export async function hasMealLogToday(
  memberId: string,
  mealType: "breakfast" | "lunch" | "dinner"
): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Define time ranges for each meal
  const mealTimeRanges = {
    breakfast: { start: 5, end: 10 },
    lunch: { start: 10, end: 15 },
    dinner: { start: 15, end: 22 },
  };

  const range = mealTimeRanges[mealType];
  const rangeStart = new Date();
  rangeStart.setHours(range.start, 0, 0, 0);
  const rangeEnd = new Date();
  rangeEnd.setHours(range.end, 0, 0, 0);

  const mealCount = await prisma.mealLog.count({
    where: {
      memberId,
      date: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
  });

  return mealCount > 0;
}

// Check if it's a weekly milestone (7, 14, 21... days from course start)
// Check if today is a weekly milestone (every 7 days from member creation)
export function isWeeklyMilestoneFromCreated(createdAt: Date): boolean {
  const now = new Date();
  const diffTime = now.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Send weekly insights every 7 days, starting from day 7
  return diffDays >= 7 && diffDays % 7 === 0;
}

// Calculate course progress percentage
// Get AI Coach status and remaining days
export function getAiCoachStatus(
  expireDate: Date | null, 
  courseDuration: number
): { isActive: boolean; isUnlimited: boolean; daysRemaining: number | null } {
  // Unlimited (courseDuration = 0)
  if (courseDuration === 0) {
    return { isActive: true, isUnlimited: true, daysRemaining: null };
  }
  
  if (!expireDate) {
    return { isActive: false, isUnlimited: false, daysRemaining: null };
  }

  const now = new Date();
  const isActive = expireDate > now;
  const daysRemaining = isActive 
    ? Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return { isActive, isUnlimited: false, daysRemaining };
}

// Gather all context data for a member
export async function gatherMemberContext(memberId: string): Promise<MemberContext | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { memberType: true },
  });

  if (!member) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfDay);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // P2: เดิม await เรียงแถว ~8 จุด (+streak เดิมอีก 30 query) ทุกครั้งที่คุยกับโค้ช → ยิงขนานชุดเดียว
  const [todayMeals, yesterdayMeals, waterLogs, recentOrders, weightLogs, exerciseToday, streakDays, personalization, budget, todayMetrics] =
    await Promise.all([
      prisma.mealLog.findMany({ where: { memberId, date: { gte: startOfDay } } }),
      prisma.mealLog.findMany({ where: { memberId, date: { gte: startOfYesterday, lt: startOfDay } } }),
      prisma.waterLog.aggregate({ where: { memberId, date: { gte: startOfDay } }, _sum: { amount: true } }),
      prisma.order.findMany({
        where: { memberId, status: { in: ["confirmed", "preparing", "ready", "delivered"] } },
        include: { items: { include: { food: true } } },
        take: 3,
        orderBy: { createdAt: "desc" },
      }),
      prisma.weightLog.findMany({
        where: { memberId, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { date: "desc" },
        take: 2,
      }),
      prisma.exerciseLog.findFirst({ where: { memberId, date: { gte: startOfDay } }, orderBy: { date: "desc" } }),
      calculateStreak(memberId),
      getPersonalizationSafe(memberId), // WO-P.3 — จุดเดียวที่ป้อน memory+insight เข้า context กลาง
      getDailyBudget(memberId).catch(() => null), // งบวันนี้ = ฐาน + คืนจากที่ออกกำลังกาย
      // วง Move/Stand/Exercise จาก Apple Health — ไม่โชว์เป็นวงในแอป แต่ให้โค้ชรู้ว่าวันนี้ขยับแค่ไหน
      prisma.dailyMetric.findMany({
        where: { memberId, date: { gte: startOfDay } },
        select: { steps: true, activeKcal: true, standHours: true, exerciseMin: true },
      }),
    ]);

  const todayTotals = todayMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const yesterdayTotals = yesterdayMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const stockItems = recentOrders.flatMap((order) =>
    order.items.map((item) => ({
      name: item.foodName,
      calories: item.calories || 0,
      protein: item.food?.protein || 0,
    }))
  );

  const weightChange =
    weightLogs.length >= 2 ? weightLogs[0].weight - weightLogs[1].weight : null;

  const maxOf = (k: "steps" | "activeKcal" | "standHours" | "exerciseMin") =>
    todayMetrics.reduce((s2, m) => Math.max(s2, m[k] ?? 0), 0);
  const activity = {
    steps: maxOf("steps"),
    activeKcal: maxOf("activeKcal"),
    standHours: maxOf("standHours"), // เป้าแบบ Apple = 12 ชม./วัน (ต้องมี Watch ถึงจะมีค่า)
    exerciseMin: maxOf("exerciseMin"), // เป้าแบบ Apple = 30 นาที/วัน
    hasWatchData: todayMetrics.some((m) => (m.standHours ?? 0) > 0),
  };

  // AI Coach status
  const courseDuration = member.memberType?.courseDuration || 0;
  const aiCoachStatus = getAiCoachStatus(member.aiCoachExpireDate, courseDuration);

  return {
    name: member.displayName || member.name || "คุณลูกค้า",
    goal: {
      type: member.goalType || "maintain",
      currentWeight: member.weight,
      targetWeight: member.goalWeight,
    },
    aiCoach: {
      isActive: aiCoachStatus.isActive,
      isUnlimited: aiCoachStatus.isUnlimited,
      daysRemaining: aiCoachStatus.daysRemaining,
      expireDate: member.aiCoachExpireDate,
    },
    today: {
      calories: Math.round(todayTotals.calories),
      protein: Math.round(todayTotals.protein),
      carbs: Math.round(todayTotals.carbs),
      fat: Math.round(todayTotals.fat),
      mealCount: todayMeals.length,
      meals: todayMeals.map((m) => m.name),
    },
    yesterday: {
      calories: Math.round(yesterdayTotals.calories),
      protein: Math.round(yesterdayTotals.protein),
      carbs: Math.round(yesterdayTotals.carbs),
      fat: Math.round(yesterdayTotals.fat),
      mealCount: yesterdayMeals.length,
    },
    budget: budget
      ? { base: budget.base, earned: budget.earned, target: budget.target, remaining: budget.remaining, week: budget.week, explain: budget.explain }
      : null,
    targets: {
      // เป้าแคลอรี่ของ "วันนี้" (ฐานวันไม่ออกกำลังกาย + ที่คืนจากการออกกำลังกายจริง)
      calories: budget?.target || member.dailyCalories || 2000,
      protein: member.dailyProtein || 100,
      carbs: member.dailyCarbs || 250,
      fat: member.dailyFat || 65,
    },
    water: {
      current: waterLogs._sum.amount || 0,
      target: member.dailyWater || 8,
    },
    stock: stockItems.slice(0, 10),
    weightChange,
    exerciseToday: exerciseToday
      ? { name: exerciseToday.name, calories: exerciseToday.calories }
      : null,
    streakDays,
    activity,
    lastActiveAt: member.updatedAt,
    personalization,
  };
}

// Calculate meal logging streak
async function calculateStreak(memberId: string): Promise<number> {
  // P1: เดิมยิง COUNT ทีละวันสูงสุด 30 query ต่อเนื่อง (ทุกครั้งที่คุยกับโค้ช/โค้ชเช้า)
  // → query เดียว: วันที่ (BKK) ที่มีบันทึกใน 30 วัน แล้วเดินนับต่อเนื่องใน JS
  const rows = await prisma.$queryRaw<Array<{ d: Date }>>`
    SELECT DISTINCT ("date" + interval '7 hours')::date AS d
    FROM meal_logs
    WHERE "memberId" = ${memberId} AND "date" >= now() - interval '31 days'
  `;
  const days = new Set(rows.map((r) => new Date(r.d).toISOString().slice(0, 10)));

  let streak = 0;
  const cursor = new Date(Date.now() + 7 * 3600 * 1000); // วันนี้ตาม BKK
  for (let i = 0; i < 30; i++) {
    if (!days.has(cursor.toISOString().slice(0, 10))) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Build prompt for AI based on message type
export function buildPrompt(type: CoachingType, context: MemberContext): string {
  const goalText =
    context.goal.type === "lose"
      ? "ลดน้ำหนัก"
      : context.goal.type === "gain"
      ? "เพิ่มน้ำหนัก"
      : "รักษาน้ำหนัก";

  // AI Coach status text
  const aiCoachStatusText = context.aiCoach.isUnlimited 
    ? "ไม่จำกัดระยะเวลา" 
    : context.aiCoach.daysRemaining 
      ? `เหลือ ${context.aiCoach.daysRemaining} วัน` 
      : "หมดอายุ";

  // WO-P.3 — ข้อมูลเฉพาะตัว (memory + insight) เข้าทุกข้อความโค้ช
  const personalBlock = context.personalization?.text ? `\n${context.personalization.text}\n` : "";

  // การขยับตัววันนี้จาก Apple Health (มีเฉพาะคนที่เชื่อม) — โค้ชใช้ทักเรื่องนั่งนาน/ขยับน้อยได้
  const a = context.activity;
  const activityBits: string[] = [];
  if (a?.steps) activityBits.push(`เดิน ${a.steps.toLocaleString()} ก้าว`);
  if (a?.activeKcal) activityBits.push(`เผาจากการเคลื่อนไหว ${a.activeKcal} kcal`);
  if (a?.exerciseMin) activityBits.push(`ออกกำลังกาย ${a.exerciseMin} นาที (เป้า Apple 30)`);
  if (a?.hasWatchData) activityBits.push(`ลุกยืน ${a.standHours}/12 ชม.`);
  // เป้าวันนี้เป็นแบบ "ฐาน + คืนจากที่ออกกำลังกาย" → โค้ชต้องอธิบายได้ถ้า user ถามว่าทำไมวันนี้กินได้เท่านี้
  const b = context.budget;
  const budgetNote = b
    ? ` (ฐานวันไม่ออกกำลังกาย ${b.base}${b.earned > 0 ? ` + ${b.earned} จากที่ออกกำลังกายวันนี้` : ""} · เหลืออีก ${b.remaining} kcal` +
      ` · งบทั้งสัปดาห์เหลือ ${b.week.remaining} kcal ใน ${b.week.daysLeft} วัน)`
    : "";
  const activityBlock = activityBits.length
    ? `- การขยับตัววันนี้: ${activityBits.join(" · ")}`
    : "";

  const baseInfo = `
ข้อมูลลูกค้า:
- ชื่อ: ${context.name}
- เป้าหมาย: ${goalText}
- น้ำหนักปัจจุบัน: ${context.goal.currentWeight || "ไม่ระบุ"} kg
- น้ำหนักเป้าหมาย: ${context.goal.targetWeight || "ไม่ระบุ"} kg
- AI Coach: ${aiCoachStatusText}
- Streak บันทึกอาหาร: ${context.streakDays} วันติด
${activityBlock}
เป้าหมายวันนี้:
- แคลอรี่: ${context.targets.calories} kcal${budgetNote}
- โปรตีน: ${context.targets.protein}g
- คาร์บ: ${context.targets.carbs}g
- ไขมัน: ${context.targets.fat}g
${personalBlock}`;

  switch (type) {
    case "morning":
      return `${baseInfo}

ผลงานเมื่อวาน:
- แคลอรี่: ${context.yesterday.calories}/${context.targets.calories} kcal (${Math.round((context.yesterday.calories / context.targets.calories) * 100)}%)
- โปรตีน: ${context.yesterday.protein}/${context.targets.protein}g (${Math.round((context.yesterday.protein / context.targets.protein) * 100)}%)
- มื้อที่บันทึก: ${context.yesterday.mealCount} มื้อ

${context.weightChange !== null ? `การเปลี่ยนแปลงน้ำหนัก 7 วันที่ผ่านมา: ${context.weightChange > 0 ? "+" : ""}${context.weightChange.toFixed(1)} kg` : ""}
${context.todayPlan ? `\nแผนวันนี้:\n- ออกกำลังกาย: ${context.todayPlan.exerciseTitle} (${context.todayPlan.exerciseMinutes} นาที)\n- อาหาร (~${context.todayPlan.totalKcal} kcal): ${context.todayPlan.mealSummary}` : ""}
${context.warnings && context.warnings.length ? `\nข้อควรระวังจากเมื่อวาน: ${context.warnings.join(" / ")}` : ""}
${context.planAdjustNote ? `\nการปรับแผนล่าสุด (ต้องบอกผู้ใช้ว่าปรับเพราะอะไร): ${context.planAdjustNote}` : ""}

กรุณาส่งข้อความกำลังใจตอนเช้า:
1. ทักทายชื่อลูกค้า
2. สรุปผลงานเมื่อวานสั้นๆ (ดี/ต้องปรับปรุง)${context.warnings && context.warnings.length ? " + เตือนเรื่องที่ต้องระวังอย่างนุ่มนวล" : ""}
3. บอกแผนวันนี้ (ออกกำลังกาย + อาหาร) แบบกระชับ
4. ให้คำแนะนำปรับให้ตรงเป้า 1 ข้อ
5. ให้กำลังใจ

ความยาวไม่เกิน 300 ตัวอักษร ห้ามแต่งตัวเลขที่ไม่มีในข้อมูล`;

    case "lunch":
      return `${baseInfo}

สถานะวันนี้ (ก่อนมื้อกลางวัน):
- ทานไปแล้ว: ${context.today.calories} kcal
- โปรตีน: ${context.today.protein}g
- มื้อที่ทาน: ${context.today.meals.join(", ") || "ยังไม่ได้ทาน"}
- แคลอรี่เหลือ: ${context.targets.calories - context.today.calories} kcal
- โปรตีนขาด: ${context.targets.protein - context.today.protein}g

อาหารใน Stock:
${context.stock.map((s) => `- ${s.name} (${s.calories} kcal, P:${s.protein}g)`).join("\n") || "- ไม่มี"}

กรุณาแนะนำมื้อกลางวัน:
1. วิเคราะห์ว่าขาดอะไร (แคลอรี่/โปรตีน/อื่นๆ)
2. แนะนำจาก Stock ก่อน (ถ้ามี)
3. ถ้า Stock ไม่พอ แนะนำอาหารเพิ่มเติม
4. บอกเหตุผลว่าทำไมแนะนำอาหารนี้

ความยาวไม่เกิน 250 ตัวอักษร`;

    case "dinner":
      return `${baseInfo}

สถานะวันนี้ (ก่อนมื้อเย็น):
- ทานไปแล้ว: ${context.today.calories} kcal (${Math.round((context.today.calories / context.targets.calories) * 100)}%)
- โปรตีน: ${context.today.protein}g (${Math.round((context.today.protein / context.targets.protein) * 100)}%)
- มื้อที่ทาน: ${context.today.meals.join(", ") || "ยังไม่ได้ทาน"}
- แคลอรี่เหลือ: ${context.targets.calories - context.today.calories} kcal
- โปรตีนขาด: ${context.targets.protein - context.today.protein}g

อาหารใน Stock:
${context.stock.map((s) => `- ${s.name} (${s.calories} kcal, P:${s.protein}g)`).join("\n") || "- ไม่มี"}

กรุณาแนะนำมื้อเย็น:
1. วิเคราะห์แคลอรี่ที่เหลือ
2. แนะนำจาก Stock ที่เหมาะสม
3. ถ้าเกินเป้า แนะนำอาหารเบาๆ
4. ถ้าขาดโปรตีน แนะนำเพิ่มโปรตีน

ความยาวไม่เกิน 250 ตัวอักษร`;

    case "evening":
      return `${baseInfo}

สรุปวันนี้:
- แคลอรี่: ${context.today.calories}/${context.targets.calories} kcal (${Math.round((context.today.calories / context.targets.calories) * 100)}%)
- โปรตีน: ${context.today.protein}/${context.targets.protein}g (${Math.round((context.today.protein / context.targets.protein) * 100)}%)
- คาร์บ: ${context.today.carbs}/${context.targets.carbs}g
- ไขมัน: ${context.today.fat}/${context.targets.fat}g
- มื้อที่บันทึก: ${context.today.mealCount} มื้อ
- น้ำ: ${context.water.current}/${context.water.target} แก้ว
${context.exerciseToday ? `- ออกกำลังกาย: ${context.exerciseToday.name} (เผา ${context.exerciseToday.calories} kcal)` : ""}

กรุณาสรุปวัน:
1. ประเมินผลโดยรวม (ทำได้ดี/ปานกลาง/ต้องปรับปรุง)
2. ชมสิ่งที่ทำได้ดี
3. บอกจุดที่ต้องปรับปรุง (ถ้ามี)
4. แนะนำสำหรับพรุ่งนี้ 1 ข้อ

ความยาวไม่เกิน 200 ตัวอักษร`;

    case "inactive":
      return `${baseInfo}

สถานะ: ไม่ได้เข้าใช้งานมาหลายวันแล้ว
${context.aiCoach.daysRemaining ? `AI Coach เหลือ: ${context.aiCoach.daysRemaining} วัน` : ""}
Streak ก่อนหน้า: ${context.streakDays} วัน

กรุณาส่งข้อความติดตามอย่างมืออาชีพ:
1. เปิดด้วยการทักทายอบอุ่น (ไม่ตำหนิ)
2. แสดงความเข้าใจว่าชีวิตอาจยุ่ง
3. ย้ำคุณค่าของการติดตามสุขภาพอย่างต่อเนื่อง
4. ให้กำลังใจกลับมาเริ่มต้นใหม่
5. บอกว่าเราพร้อมช่วยเหลือเสมอ

โทนเสียง: อบอุ่น เป็นมิตร เป็นมืออาชีพ ไม่กดดัน
ความยาวไม่เกิน 180 ตัวอักษร`;

    case "milestone":
      return `${baseInfo}

Milestone: บันทึกอาหารติดต่อกัน ${context.streakDays} วันแล้ว!
${context.weightChange !== null ? `น้ำหนักเปลี่ยนแปลง: ${context.weightChange > 0 ? "+" : ""}${context.weightChange.toFixed(1)} kg` : ""}

กรุณาส่งข้อความฉลอง:
1. ยินดีด้วยกับความสำเร็จ
2. สรุปผลลัพธ์ที่ทำได้
3. ให้กำลังใจไปต่อ

ความยาวไม่เกิน 150 ตัวอักษร`;

    case "exercise":
      return `${baseInfo}

ออกกำลังกายวันนี้:
- กิจกรรม: ${context.exerciseToday?.name || "ไม่ระบุ"}
- เผาไป: ${context.exerciseToday?.calories || 0} kcal

แคลอรี่วันนี้ (หลังออกกำลังกาย):
- เป้าหมายเดิม: ${context.targets.calories} kcal
- บวกจากออกกำลังกาย: +${context.exerciseToday?.calories || 0} kcal
- ทานได้: ${context.targets.calories + (context.exerciseToday?.calories || 0)} kcal

อาหารใน Stock:
${context.stock.map((s) => `- ${s.name} (${s.calories} kcal, P:${s.protein}g)`).join("\n") || "- ไม่มี"}

กรุณาแนะนำอาหารฟื้นฟูหลังออกกำลังกาย:
1. แนะนำจาก Stock ที่มีโปรตีนสูง
2. บอกว่าควรทานภายใน 30-60 นาที
3. อธิบายประโยชน์สั้นๆ

ความยาวไม่เกิน 150 ตัวอักษร`;

    default:
      return `${baseInfo}

กรุณาให้คำแนะนำทั่วไปเกี่ยวกับโภชนาการ
ความยาวไม่เกิน 150 ตัวอักษร`;
  }
}

// Generate AI message
export async function generateCoachingMessage(
  type: CoachingType,
  context: MemberContext
): Promise<string> {
  const apiKey = await getSecret("OPENAI_API_KEY");

  if (!apiKey) {
    console.log("OPENAI_API_KEY not configured, using fallback");
    return getFallbackMessage(type, context);
  }

  try {
    const openai = buildOpenAI(apiKey);
    const prompt = buildPrompt(type, context);

    const response = await openai.chat.completions.create({
      model: aiModel(apiKey, "gpt-4o-mini"),
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content?.trim() || getFallbackMessage(type, context);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return getFallbackMessage(type, context);
  }
}

// Fallback messages when AI is unavailable
function getFallbackMessage(type: CoachingType, context: MemberContext): string {
  const name = context.name;
  const daysText = context.aiCoach.daysRemaining ? `(เหลือ ${context.aiCoach.daysRemaining} วัน)` : "";
  
  switch (type) {
    case "morning":
      return `สวัสดีตอนเช้าครับ${name}! 🌅 มาทำให้ดีกันต่อนะครับ ${daysText} 💪`;
    case "lunch":
      return `ใกล้เที่ยงแล้วครับ${name} 🍽️ อย่าลืมบันทึกมื้อกลางวันนะครับ เหลือแคลอรี่อีก ${context.targets.calories - context.today.calories} kcal`;
    case "dinner":
      return `ถึงเวลามื้อเย็นแล้วครับ${name} 🍽️ วันนี้เหลือแคลอรี่ ${context.targets.calories - context.today.calories} kcal`;
    case "evening":
      return `สรุปวันนี้ครับ${name} 📊 แคลอรี่ ${context.today.calories}/${context.targets.calories} kcal พรุ่งนี้สู้ต่อนะครับ!`;
    case "inactive":
      return `สวัสดีครับคุณ${name} 👋 เราไม่ได้เจอกันหลายวันแล้ว หวังว่าคุณสบายดีนะครับ เรายังคงพร้อมช่วยดูแลสุขภาพของคุณเสมอ กลับมาเมื่อพร้อมนะครับ`;
    case "milestone":
      return `ยินดีด้วยครับ${name}! 🎉 บันทึกติดต่อกัน ${context.streakDays} วันแล้ว! ไปต่อกันเลย 💪`;
    case "exercise":
      return `เยี่ยมเลยครับ${name}! 🏃 ออกกำลังกายเผาไป ${context.exerciseToday?.calories || 0} kcal อย่าลืมเติมโปรตีนนะครับ`;
    default:
      return `สู้ๆ นะครับ${name}! 💪`;
  }
}

// Create LINE Flex Message for coaching
export function createCoachingFlexMessage(
  type: CoachingType,
  message: string,
  context: MemberContext
): ReturnType<typeof createFlexMessage> {
  const iconMap: Record<CoachingType, string> = {
    morning: "🌅",
    lunch: "🍽️",
    dinner: "🍽️",
    evening: "📊",
    weekly: "💡",
    photo: "📸",
    exercise: "🏃",
    milestone: "🎉",
    inactive: "👋",
  };

  const titleMap: Record<CoachingType, string> = {
    morning: "กำลังใจตอนเช้า",
    lunch: "แนะนำมื้อกลางวัน",
    dinner: "แนะนำมื้อเย็น",
    evening: "สรุปวันนี้",
    weekly: "Insights สัปดาห์",
    photo: "ถ่ายรูปความคืบหน้า",
    exercise: "หลังออกกำลังกาย",
    milestone: "ยินดีด้วย!",
    inactive: "เราคิดถึงคุณ",
  };

  const icon = iconMap[type];
  const title = titleMap[type];

  // Build AI Coach status text
  const aiCoachStatusText = context.aiCoach.isUnlimited 
    ? "∞ ไม่จำกัด" 
    : context.aiCoach.daysRemaining 
      ? `เหลือ ${context.aiCoach.daysRemaining} วัน`
      : "";

  return createFlexMessage(`${icon} ${title}`, {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: icon,
              size: "xl",
              flex: 0,
            },
            {
              type: "text",
              text: title,
              weight: "bold",
              size: "lg",
              color: "#1DB446",
              margin: "md",
            },
          ],
        },
        ...(aiCoachStatusText
          ? [
              {
                type: "box" as const,
                layout: "vertical" as const,
                margin: "md" as const,
                contents: [
                  {
                    type: "text" as const,
                    text: `AI Coach: ${aiCoachStatusText}`,
                    size: "sm" as const,
                    color: "#888888",
                  },
                ],
              },
            ]
          : []),
        {
          type: "separator",
          margin: "lg",
        },
        {
          type: "text",
          text: message,
          wrap: true,
          size: "md",
          margin: "lg",
          color: "#333333",
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          action: {
            type: "uri",
            label: "เปิดแอป",
            uri: process.env.LIFF_URL || "https://goodfood.in.th/cal",
          },
        },
      ],
    },
  });
}

// LIFF deep-link ไปหน้าใดหน้าหนึ่ง (เปิดในแอป LINE พร้อม login)
export function liffUrlForPath(path: string): string {
  const id = process.env.NEXT_PUBLIC_LIFF_ID_CAL;
  if (id) return `https://liff.line.me/${id}${path}`;
  return `https://goodfood.in.th${path}`;
}

// Flex สำหรับโค้ชเช้า (เฟส 2) — มี section แผนวันนี้ + ปุ่มดูปฏิทิน
export function createMorningCoachFlex(
  message: string,
  context: MemberContext
): ReturnType<typeof createFlexMessage> {
  const planContents = context.todayPlan
    ? [
        { type: "separator" as const, margin: "lg" as const },
        {
          type: "box" as const,
          layout: "vertical" as const,
          margin: "lg" as const,
          spacing: "xs" as const,
          contents: [
            { type: "text" as const, text: "📋 แผนวันนี้", weight: "bold" as const, size: "sm" as const, color: "#1DB446" },
            { type: "text" as const, text: `🏃 ${context.todayPlan.exerciseTitle} · ${context.todayPlan.exerciseMinutes} นาที`, size: "sm" as const, color: "#555555", wrap: true },
            { type: "text" as const, text: `🍽️ ~${context.todayPlan.totalKcal} kcal · ${context.todayPlan.mealSummary}`, size: "sm" as const, color: "#555555", wrap: true },
          ],
        },
      ]
    : [];

  return createFlexMessage("🌅 กำลังใจตอนเช้า", {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "🌅", size: "xl", flex: 0 },
            { type: "text", text: "โค้ชกู๊ดทักตอนเช้า", weight: "bold", size: "lg", color: "#1DB446", margin: "md" },
          ],
        },
        { type: "separator", margin: "lg" },
        { type: "text", text: message, wrap: true, size: "md", margin: "lg", color: "#333333" },
        ...planContents,
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          action: { type: "uri", label: "ดูปฏิทินแผน", uri: liffUrlForPath("/plan") },
        },
      ],
    },
  });
}

// Send coaching message to a member
export async function sendCoachingMessage(
  memberId: string,
  type: CoachingType
): Promise<boolean> {
  try {
    // Check if should send
    const shouldSend = await shouldSendNotification(memberId, type);
    if (!shouldSend) {
      console.log(`Skipping ${type} notification for member ${memberId}`);
      return false;
    }

    // Get member
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member?.lineUserId) {
      console.log(`Member ${memberId} has no LINE user ID`);
      return false;
    }

    // Gather context
    const context = await gatherMemberContext(memberId);
    if (!context) {
      console.log(`Failed to gather context for member ${memberId}`);
      return false;
    }

    // Generate message
    const message = await generateCoachingMessage(type, context);

    // Create and send Flex message
    const flexMessage = createCoachingFlexMessage(type, message, context);
    const success = await pushMessage(member.lineUserId, [flexMessage]);

    if (success) {
      console.log(`Sent ${type} coaching to member ${memberId}`);
    } else {
      console.log(`Failed to send ${type} coaching to member ${memberId}`);
    }

    return success;
  } catch (error) {
    console.error(`Error sending coaching to member ${memberId}:`, error);
    return false;
  }
}
