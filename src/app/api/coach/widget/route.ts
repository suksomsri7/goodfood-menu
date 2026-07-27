import { NextRequest, NextResponse } from "next/server";
import { getAuthedMember } from "@/lib/coachAuth";
import { prisma } from "@/lib/prisma";
import { bkkTodayKey } from "@/lib/planGenerator";

/**
 * ข้อมูลเบาสำหรับ Widget / Complication (WO-5.1) — วงแหวนวันนี้ + มื้อถัดไป
 * GET (Bearer) → { calories:{v,goal}, water:{v,goal}, protein:{v,goal}, nextMeal }
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setHours(23, 59, 59, 999);
  const [meals, water, plan] = await Promise.all([
    prisma.mealLog.aggregate({ where: { memberId: member.id, date: { gte: s, lte: e } }, _sum: { calories: true, protein: true } }),
    prisma.waterLog.aggregate({ where: { memberId: member.id, date: { gte: s, lte: e } }, _sum: { amount: true } }),
    prisma.dailyPlan.findUnique({ where: { memberId_date: { memberId: member.id, date: bkkTodayKey() } } }),
  ]);

  // มื้อถัดไปจากแผนที่ยังไม่ติ๊ก
  let nextMeal: string | null = null;
  const mp = plan?.mealPlan as { meals?: { slot: string; menu: string }[] } | null;
  const done = (plan?.mealsDone as Record<string, boolean>) || {};
  if (mp?.meals) { const nm = mp.meals.find((m) => !done[m.slot]); if (nm) nextMeal = `${nm.slot}: ${nm.menu}`; }

  return NextResponse.json({
    calories: { v: Math.round(meals._sum.calories || 0), goal: member.dailyCalories || 2000 },
    water: { v: water._sum.amount || 0, goal: member.dailyWater || 2000 },
    protein: { v: Math.round(meals._sum.protein || 0), goal: member.dailyProtein || 100 },
    nextMeal,
  });
}
