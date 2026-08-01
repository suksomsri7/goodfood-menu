import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedMember } from "@/lib/coachAuth";

/**
 * ข้อมูลกราฟสถิติ (Coach native)
 * GET ?days=7|30|90 (Bearer) →
 * { days:[{date, kcal, burned, water, sleepMin, steps, standHours, exerciseMin}], weights:[{date,weight}], member:{...targets} }
 */
export async function GET(req: NextRequest) {
  const member = await getAuthedMember(req);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const daysParam = parseInt(new URL(req.url).searchParams.get("days") || "7", 10);
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const [meals, exercises, waters, sleeps, weights, metrics] = await Promise.all([
    prisma.mealLog.findMany({ where: { memberId: member.id, date: { gte: start } }, select: { calories: true, date: true } }),
    prisma.exerciseLog.findMany({ where: { memberId: member.id, date: { gte: start } }, select: { calories: true, date: true } }),
    prisma.waterLog.findMany({ where: { memberId: member.id, date: { gte: start } }, select: { amount: true, date: true } }),
    prisma.sleepLog.findMany({ where: { memberId: member.id, date: { gte: start } }, select: { minutesAsleep: true, date: true } }),
    prisma.weightLog.findMany({
      where: { memberId: member.id, date: { gte: new Date(Date.now() - 120 * 24 * 3600 * 1000) } },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    }),
    // ก้าว/ยืน/นาทีขยับ จาก Apple Health — แสดงเป็นบรรทัดสรุปในหน้าสถิติ (ไม่ใช่วงในหน้าหลัก)
    prisma.dailyMetric.findMany({
      where: { memberId: member.id, date: { gte: start } },
      select: { steps: true, standHours: true, exerciseMin: true, date: true },
    }),
  ]);

  // aggregate ต่อวัน (local server = UTC; ใช้ date key แบบ device-local ผ่าน toISOString ของวัน — ยอมรับได้สำหรับกราฟ)
  const byDay: Record<string, { kcal: number; burned: number; water: number; sleepMin: number; steps: number; standHours: number; exerciseMin: number }> = {};
  const key = (d: Date) => {
    const b = new Date(d.getTime() + 7 * 3600 * 1000); // BKK
    return b.toISOString().slice(0, 10);
  };
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    byDay[key(d)] = { kcal: 0, burned: 0, water: 0, sleepMin: 0, steps: 0, standHours: 0, exerciseMin: 0 };
  }
  meals.forEach((m) => { const k = key(m.date); if (byDay[k]) byDay[k].kcal += m.calories; });
  exercises.forEach((e) => { const k = key(e.date); if (byDay[k]) byDay[k].burned += e.calories; });
  waters.forEach((w) => { const k = key(w.date); if (byDay[k]) byDay[k].water += w.amount; });
  // นับซ้ำไม่ได้: คืนเดียวอาจมีทั้ง healthkit และที่ user บอกโค้ช → เอาค่ามากสุดของวันนั้น
  sleeps.forEach((s) => { const k = key(s.date); if (byDay[k]) byDay[k].sleepMin = Math.max(byDay[k].sleepMin, s.minutesAsleep); });
  metrics.forEach((m) => {
    const k = key(m.date);
    if (!byDay[k]) return;
    byDay[k].steps = Math.max(byDay[k].steps, m.steps ?? 0);
    byDay[k].standHours = Math.max(byDay[k].standHours, m.standHours ?? 0);
    byDay[k].exerciseMin = Math.max(byDay[k].exerciseMin, m.exerciseMin ?? 0);
  });

  return NextResponse.json({
    days: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
    weights: weights.map((w) => ({ date: w.date, weight: w.weight })),
    member: {
      dailyCalories: member.dailyCalories, dailyWater: member.dailyWater,
      weight: member.weight, goalWeight: member.goalWeight, goalType: member.goalType,
    },
  });
}
