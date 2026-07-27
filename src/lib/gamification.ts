/**
 * Gamification + สรุป (WO-5.4) — streak / badges / weekly review
 * คำนวณจากข้อมูลจริง (MealLog/WaterLog/ExerciseLog/WeightLog/DailyPlan)
 */
import { prisma } from "@/lib/prisma";

function dayRange(offset: number) {
  const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - offset);
  const e = new Date(s); e.setHours(23, 59, 59, 999);
  return { s, e };
}

async function streakDays(memberId: string): Promise<number> {
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const { s, e } = dayRange(i);
    const c = await prisma.mealLog.count({ where: { memberId, date: { gte: s, lte: e } } });
    if (c > 0) streak++; else break;
  }
  return streak;
}

export type Badge = { key: string; label: string; icon: string; earned: boolean };

export async function computeStats(member: {
  id: string; weight: number | null; goalWeight: number | null; goalType: string | null;
  dailyProtein: number | null; dailyWater: number | null;
}) {
  const memberId = member.id;
  const streak = await streakDays(memberId);
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [meals7, water7days, exercise7, plans7, firstMeal, weights] = await Promise.all([
    prisma.mealLog.findMany({ where: { memberId, date: { gte: since7 } }, select: { calories: true, protein: true, date: true } }),
    prisma.waterLog.groupBy({ by: ["memberId"], where: { memberId, date: { gte: since7 } }, _sum: { amount: true } }),
    prisma.exerciseLog.aggregate({ where: { memberId, date: { gte: since7 } }, _sum: { calories: true }, _count: true }),
    prisma.dailyPlan.findMany({ where: { memberId, date: { gte: since7 } }, select: { status: true } }),
    prisma.mealLog.findFirst({ where: { memberId }, orderBy: { date: "asc" }, select: { id: true } }),
    prisma.weightLog.findMany({ where: { memberId }, orderBy: { date: "asc" }, select: { weight: true } }),
  ]);

  // จำนวนวันที่บันทึกใน 7 วัน
  const loggedDays = new Set(meals7.map((m) => m.date.toISOString().slice(0, 10))).size;
  const avgKcal = loggedDays ? Math.round(meals7.reduce((a, b) => a + b.calories, 0) / loggedDays) : 0;
  const proteinTarget = member.dailyProtein || 100;
  // วันที่โปรตีนถึงเป้า
  const proteinByDay: Record<string, number> = {};
  meals7.forEach((m) => { const k = m.date.toISOString().slice(0, 10); proteinByDay[k] = (proteinByDay[k] || 0) + (m.protein || 0); });
  const proteinHitDays = Object.values(proteinByDay).filter((v) => v >= proteinTarget).length;

  const adherence = plans7.length
    ? plans7.reduce((a, p) => a + (p.status === "done" ? 1 : p.status === "partial" ? 0.5 : 0), 0) / plans7.length
    : 0;

  // weight progress ไปทางเป้า
  let weightProgress = false;
  if (weights.length >= 2 && member.goalType) {
    const delta = weights[weights.length - 1].weight - weights[0].weight;
    if (member.goalType === "lose") weightProgress = delta < -0.1;
    else if (member.goalType === "gain") weightProgress = delta > 0.1;
    else weightProgress = Math.abs(delta) < 0.5;
  }

  const badges: Badge[] = [
    { key: "starter", label: "เริ่มต้นแล้ว", icon: "🌱", earned: !!firstMeal },
    { key: "streak7", label: "7 วันติด", icon: "🔥", earned: streak >= 7 },
    { key: "streak30", label: "30 วันติด", icon: "🏆", earned: streak >= 30 },
    { key: "protein", label: "สายโปรตีน", icon: "🥩", earned: proteinHitDays >= 3 },
    { key: "adherence", label: "ทำตามแผน", icon: "✅", earned: adherence >= 0.8 && plans7.length >= 3 },
    { key: "progress", label: "เข้าเป้า", icon: "📉", earned: weightProgress },
  ];

  return {
    streak,
    badges,
    weeklyReview: {
      loggedDays,
      avgKcal,
      exerciseKcal: exercise7._sum.calories || 0,
      exerciseCount: exercise7._count || 0,
      waterMl: water7days[0]?._sum.amount || 0,
      adherence: Math.round(adherence * 100),
      proteinHitDays,
    },
  };
}
