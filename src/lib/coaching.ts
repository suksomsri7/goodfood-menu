import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { pushMessage, createFlexMessage } from "@/lib/line";

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
  | "water" 
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
  lastActiveAt: Date | null;
}

// Check if AI Coach is active for member
export function isAiCoachActive(member: { 
  memberType: { courseDuration: number } | null; 
  aiCoachExpireDate: Date | null 
}): boolean {
  if (!member.memberType) return false;
  
  // Unlimited (courseDuration = 0)
  if (member.memberType.courseDuration === 0) return true;
  
  // Check expire date
  if (!member.aiCoachExpireDate) return false;
  return member.aiCoachExpireDate > new Date();
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
  const aiCoachActiveCheck = isAiCoachActive(member);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:shouldSendNotification',message:'AI Coach active check',data:{memberId,type,aiCoachActive:aiCoachActiveCheck,memberTypeId:member.memberTypeId,memberTypeName:member.memberType?.name,courseDuration:member.memberType?.courseDuration,aiCoachExpireDate:member.aiCoachExpireDate?.toISOString()},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!aiCoachActiveCheck) {
    console.log("[Coaching] AI Coach not active for member:", memberId);
    return false;
  }

  // Check if notifications are paused
  if (
    member.notificationsPausedUntil &&
    member.notificationsPausedUntil > new Date()
  ) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:shouldSendNotification',message:'Notifications paused',data:{memberId,pausedUntil:member.notificationsPausedUntil?.toISOString()},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return false;
  }

  // Check notification preference by type
  const notificationMap: Record<CoachingType, boolean> = {
    morning: member.notifyMorningCoach,
    evening: member.notifyEveningSummary,
    lunch: member.notifyLunchSuggestion,
    dinner: member.notifyDinnerSuggestion,
    water: member.notifyWaterReminder,
    weekly: member.notifyWeeklyInsights,
    photo: member.notifyProgressPhoto,
    exercise: member.notifyPostExercise,
    milestone: true, // Always send milestones
    inactive: true, // Always send inactive reminders
  };

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:shouldSendNotification',message:'Notification preference check',data:{memberId,type,prefEnabled:notificationMap[type],allPrefs:{exercise:member.notifyPostExercise,water:member.notifyWaterReminder}},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!notificationMap[type]) {
    return false;
  }

  // Type-specific checks
  switch (type) {
    case "water":
      return await shouldSendWaterReminder(memberId);
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

// Check if user needs water reminder
export async function shouldSendWaterReminder(memberId: string): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  
  if (!member) return false;
  
  const now = new Date();
  const hour = now.getHours();
  const totalGoal = member.dailyWater || 8;

  // Calculate expected glasses by now (distributed across 7am-9pm)
  const activeHours = Math.max(0, Math.min(14, hour - 7)); // 7am to 9pm
  const expectedByNow = Math.floor((activeHours / 14) * totalGoal);

  // Get today's water logs
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const waterLogs = await prisma.waterLog.aggregate({
    where: {
      memberId,
      date: { gte: startOfDay },
    },
    _sum: { amount: true },
  });

  const actualDrunk = waterLogs._sum.amount || 0;

  // Send reminder if drunk less than expected
  return actualDrunk < expectedByNow;
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

  // Get today's meals
  const todayMeals = await prisma.mealLog.findMany({
    where: {
      memberId,
      date: { gte: startOfDay },
    },
  });

  // Get yesterday's meals
  const yesterdayMeals = await prisma.mealLog.findMany({
    where: {
      memberId,
      date: {
        gte: startOfYesterday,
        lt: startOfDay,
      },
    },
  });

  // Calculate totals
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

  // Get water logs
  const waterLogs = await prisma.waterLog.aggregate({
    where: {
      memberId,
      date: { gte: startOfDay },
    },
    _sum: { amount: true },
  });

  // Get stock (recent orders)
  const recentOrders = await prisma.order.findMany({
    where: {
      memberId,
      status: { in: ["confirmed", "preparing", "ready", "delivered"] },
    },
    include: {
      items: {
        include: {
          food: true,
        },
      },
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  const stockItems = recentOrders.flatMap((order) =>
    order.items.map((item) => ({
      name: item.foodName,
      calories: item.calories || 0,
      protein: item.food?.protein || 0,
    }))
  );

  // Get weight change (last 7 days)
  const weightLogs = await prisma.weightLog.findMany({
    where: {
      memberId,
      date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { date: "desc" },
    take: 2,
  });

  const weightChange =
    weightLogs.length >= 2 ? weightLogs[0].weight - weightLogs[1].weight : null;

  // Get today's exercise
  const exerciseToday = await prisma.exerciseLog.findFirst({
    where: {
      memberId,
      date: { gte: startOfDay },
    },
    orderBy: { date: "desc" },
  });

  // Calculate streak
  const streakDays = await calculateStreak(memberId);

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
    targets: {
      calories: member.dailyCalories || 2000,
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
    lastActiveAt: member.updatedAt,
  };
}

// Calculate meal logging streak
async function calculateStreak(memberId: string): Promise<number> {
  let streak = 0;
  let date = new Date();

  for (let i = 0; i < 30; i++) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const mealCount = await prisma.mealLog.count({
      where: {
        memberId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (mealCount > 0) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
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

  const baseInfo = `
ข้อมูลลูกค้า:
- ชื่อ: ${context.name}
- เป้าหมาย: ${goalText}
- น้ำหนักปัจจุบัน: ${context.goal.currentWeight || "ไม่ระบุ"} kg
- น้ำหนักเป้าหมาย: ${context.goal.targetWeight || "ไม่ระบุ"} kg
- AI Coach: ${aiCoachStatusText}
- Streak บันทึกอาหาร: ${context.streakDays} วันติด

เป้าหมายวันนี้:
- แคลอรี่: ${context.targets.calories} kcal
- โปรตีน: ${context.targets.protein}g
- คาร์บ: ${context.targets.carbs}g
- ไขมัน: ${context.targets.fat}g
`;

  switch (type) {
    case "morning":
      return `${baseInfo}

ผลงานเมื่อวาน:
- แคลอรี่: ${context.yesterday.calories}/${context.targets.calories} kcal (${Math.round((context.yesterday.calories / context.targets.calories) * 100)}%)
- โปรตีน: ${context.yesterday.protein}/${context.targets.protein}g (${Math.round((context.yesterday.protein / context.targets.protein) * 100)}%)
- มื้อที่บันทึก: ${context.yesterday.mealCount} มื้อ

${context.weightChange !== null ? `การเปลี่ยนแปลงน้ำหนัก 7 วันที่ผ่านมา: ${context.weightChange > 0 ? "+" : ""}${context.weightChange.toFixed(1)} kg` : ""}

กรุณาส่งข้อความกำลังใจตอนเช้า:
1. ทักทายชื่อลูกค้า
2. สรุปผลงานเมื่อวานสั้นๆ (ดี/ต้องปรับปรุง)
3. บอกเป้าหมายวันนี้
4. ให้คำแนะนำเฉพาะเจาะจง 1 ข้อ
5. ให้กำลังใจ

ความยาวไม่เกิน 200 ตัวอักษร`;

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

    case "water":
      return `${baseInfo}

สถานะน้ำ:
- ดื่มแล้ว: ${context.water.current} แก้ว
- เป้าหมาย: ${context.water.target} แก้ว
- เหลือ: ${context.water.target - context.water.current} แก้ว
- เวลาปัจจุบัน: ${new Date().getHours()}:00 น.

กรุณาเตือนดื่มน้ำ:
1. บอกสถานะปัจจุบัน
2. ให้เหตุผลว่าทำไมควรดื่มน้ำ
3. ให้กำลังใจ

ความยาวไม่เกิน 100 ตัวอักษร`;

    case "inactive":
      return `${baseInfo}

สถานะ: ไม่ได้บันทึกอาหารมาหลายวันแล้ว
${context.aiCoach.daysRemaining ? `AI Coach เหลือ: ${context.aiCoach.daysRemaining} วัน` : ""}

กรุณาส่งข้อความติดตาม:
1. แสดงความเป็นห่วง (ไม่ตำหนิ)
2. ย้ำ Streak ที่ทำได้ (${context.streakDays} วัน)
3. ให้กำลังใจกลับมา
4. แนะนำว่าถ่ายรูปไว้ก่อนแล้วค่อยบันทึกทีหลังก็ได้

ความยาวไม่เกิน 150 ตัวอักษร`;

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
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log("OPENAI_API_KEY not configured, using fallback");
    return getFallbackMessage(type, context);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = buildPrompt(type, context);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    case "water":
      return `อย่าลืมดื่มน้ำนะครับ${name}! 💧 ตอนนี้ ${context.water.current}/${context.water.target} แก้ว`;
    case "inactive":
      return `คิดถึงนะครับ${name}! 😊 กลับมาบันทึกอาหารกันต่อนะครับ`;
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
    water: "💧",
    weekly: "💡",
    photo: "📸",
    exercise: "🏃",
    milestone: "🎉",
    inactive: "😊",
  };

  const titleMap: Record<CoachingType, string> = {
    morning: "กำลังใจตอนเช้า",
    lunch: "แนะนำมื้อกลางวัน",
    dinner: "แนะนำมื้อเย็น",
    evening: "สรุปวันนี้",
    water: "เตือนดื่มน้ำ",
    weekly: "Insights สัปดาห์",
    photo: "ถ่ายรูปความคืบหน้า",
    exercise: "หลังออกกำลังกาย",
    milestone: "ยินดีด้วย!",
    inactive: "คิดถึงนะ",
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
            uri: process.env.LIFF_URL || "https://liff.line.me/2009033721-Ou7cdCtC",
          },
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'Function called',data:{memberId,type},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    // Check if should send
    const shouldSend = await shouldSendNotification(memberId, type);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'shouldSendNotification result',data:{memberId,type,shouldSend},hypothesisId:'H2-H3',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'No LINE user ID',data:{memberId},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return false;
    }

    // Gather context
    const context = await gatherMemberContext(memberId);
    if (!context) {
      console.log(`Failed to gather context for member ${memberId}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'Failed to gather context',data:{memberId},hypothesisId:'H5',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return false;
    }

    // Generate message
    const message = await generateCoachingMessage(type, context);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'Message generated',data:{memberId,type,messageLength:message.length},hypothesisId:'H5',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Create and send Flex message
    const flexMessage = createCoachingFlexMessage(type, message, context);
    const success = await pushMessage(member.lineUserId, [flexMessage]);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'LINE push result',data:{memberId,type,lineUserId:member.lineUserId,success},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (success) {
      console.log(`Sent ${type} coaching to member ${memberId}`);
    } else {
      console.log(`Failed to send ${type} coaching to member ${memberId}`);
    }

    return success;
  } catch (error) {
    console.error(`Error sending coaching to member ${memberId}:`, error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/60d048e4-60e7-4d20-95e1-ab93262422a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'coaching.ts:sendCoachingMessage',message:'Exception caught',data:{memberId,type,error:String(error)},hypothesisId:'H4-H5',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return false;
  }
}
